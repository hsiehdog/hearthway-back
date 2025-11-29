import { startUploadedExpenseWorker } from "../queues/uploadedExpenseQueue";
import { logger } from "../utils/logger";

async function main() {
  startUploadedExpenseWorker();
  logger.info("Uploaded expense worker started");
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Worker failed to start", error);
  process.exit(1);
});
