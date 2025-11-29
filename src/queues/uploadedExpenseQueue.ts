import { Queue, Worker, Job } from "bullmq";
import { parseUploadedExpense } from "../services/uploadedExpenseParserService";
import { prisma } from "../lib/prisma";
import { UploadProcessingStatus } from "@prisma/client";
import { logger } from "../utils/logger";

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
};

export const uploadedExpenseQueue = new Queue<{ uploadId: string }>("uploaded-expense-processing", {
  connection,
});

export function startUploadedExpenseWorker() {
  const worker = new Worker<{ uploadId: string }>(
    "uploaded-expense-processing",
    async (job: Job<{ uploadId: string }>) => {
      const { uploadId } = job.data;
      await prisma.uploadedExpense.update({
        where: { id: uploadId },
        data: {
          processingStatus: UploadProcessingStatus.RUNNING,
          processingAttempts: { increment: 1 },
          startedAt: new Date(),
          lastError: null,
        },
      });

      try {
        await parseUploadedExpense(uploadId);
        await prisma.uploadedExpense.update({
          where: { id: uploadId },
          data: {
            processingStatus: UploadProcessingStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      } catch (error: any) {
        logger.error("Upload processing failed", { uploadId, error });
        await prisma.uploadedExpense.update({
          where: { id: uploadId },
          data: {
            processingStatus: UploadProcessingStatus.FAILED,
            lastError: error?.message ?? "Processing failed",
          },
        });
        throw error;
      }
    },
    { connection },
  );

  worker.on("failed", (job, err) => {
    logger.error("Job failed", { jobId: job?.id, error: err });
  });
  worker.on("completed", (job) => {
    logger.info("Job completed", { jobId: job.id });
  });

  return worker;
}
