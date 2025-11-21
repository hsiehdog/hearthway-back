import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import env from "../config/env";
import { prisma } from "../lib/prisma";
import { downloadFromS3 } from "../lib/storage";
import { logger } from "../utils/logger";
import { UploadParsingStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

export async function parseUploadedExpense(uploadId: string): Promise<void> {
  const upload = await prisma.uploadedExpense.findUnique({
    where: { id: uploadId },
    select: {
      id: true,
      expenseId: true,
      storageKey: true,
      originalFileName: true,
      fileType: true,
    },
  });

  if (!upload) {
    return;
  }

  await prisma.uploadedExpense.update({
    where: { id: uploadId },
    data: {
      parsingStatus: UploadParsingStatus.IN_PROGRESS,
      errorMessage: null,
    },
  });

  try {
    const fileBuffer = await downloadFromS3(upload.storageKey);
    const base64 = fileBuffer.toString("base64");
    const dataUrl = `data:${upload.fileType};base64,${base64}`;

    const systemPrompt = `
You are a parser that reads receipts/expense documents and returns JSON for creating expense records.
Respond ONLY with valid JSON. Schema:
{
  "amount": number,
  "currency": string,
  "date": string, // ISO format if available
  "category": string | null,
  "note": string | null,
  "lineItems": [
    {
      "description": string | null,
      "category": string | null,
      "quantity": number | null,
      "unitAmount": number | null,
      "totalAmount": number | null
    }
  ]
}
If data is missing, use null. Prefer exact totals from the document.`;

    const result = await generateText({
      model: openai(env.AI_MODEL),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Parse this receipt/document (file name: ${upload.originalFileName}).`,
            },
            {
              type: "image",
              image: dataUrl,
            },
          ],
        },
      ],
    });

    const parsedJson = JSON.parse(result.text);
    console.log("Parsed JSON:", parsedJson);
    await prisma.uploadedExpense.update({
      where: { id: uploadId },
      data: {
        parsingStatus: UploadParsingStatus.SUCCESS,
        rawText: result.text,
        parsedJson,
      },
    });

    // Apply parsed data to expense
    const lineItemsData = Array.isArray(parsedJson?.lineItems)
      ? parsedJson.lineItems
          .map((item: any) => ({
            description: item?.description ?? null,
            category: item?.category ?? null,
            quantity:
              item?.quantity != null
                ? new Prisma.Decimal(item.quantity)
                : new Prisma.Decimal(1),
            unitAmount:
              item?.unitAmount != null
                ? new Prisma.Decimal(item.unitAmount)
                : new Prisma.Decimal(0),
            totalAmount:
              item?.totalAmount != null
                ? new Prisma.Decimal(item.totalAmount)
                : new Prisma.Decimal(0),
          }))
          .filter(Boolean)
      : [];

    await prisma.expense.update({
      where: { id: upload.expenseId },
      data: {
        amount:
          parsedJson?.amount != null
            ? new Prisma.Decimal(parsedJson.amount)
            : undefined,
        currency: parsedJson?.currency ?? undefined,
        date: parsedJson?.date ? new Date(parsedJson.date) : undefined,
        category: parsedJson?.category ?? undefined,
        note: parsedJson?.note ?? undefined,
        lineItems: lineItemsData.length
          ? {
              deleteMany: { expenseId: upload.expenseId },
              create: lineItemsData,
            }
          : undefined,
      },
    });
  } catch (error) {
    logger.error("Failed to parse uploaded expense", { uploadId, error });
    await prisma.uploadedExpense.update({
      where: { id: uploadId },
      data: {
        parsingStatus: UploadParsingStatus.FAILED,
        errorMessage:
          error instanceof Error ? error.message : "Unknown parsing error",
      },
    });
  }
}
