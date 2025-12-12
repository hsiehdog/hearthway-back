import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import * as transportService from "../services/transportService";
import { transportChatService } from "../services/transportChatService";
import { httpHandler } from "./httpHandler";

const groupParamsSchema = z.object({
  groupId: z.string().min(1, "groupId is required"),
});

const createFlightBodySchema = z.object({
  airlineCode: z.string().min(2, "airlineCode is required").max(3),
  flightNumber: z.string().min(1, "flightNumber is required").max(10),
  departureDate: z.coerce.date(),
  memberIds: z.array(z.string().min(1)).default([]),
});

const memberTransportParamsSchema = z.object({
  groupId: z.string().min(1, "groupId is required"),
  memberId: z.string().min(1, "memberId is required"),
});

const transportChatSchema = z.object({
  message: z.string().min(1, "message is required"),
});

export const createFlightItineraryItem = httpHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { groupId } = groupParamsSchema.parse(req.params);
    const body = createFlightBodySchema.parse(req.body);

    const itineraryItem = await transportService.createFlightItineraryItem({
      groupId,
      airlineCode: body.airlineCode,
      flightNumber: body.flightNumber,
      departureDate: body.departureDate,
      memberIds: body.memberIds,
    });

    res.status(201).json({ itineraryItem });
  }
);

export const getMemberTransport = httpHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { groupId, memberId } = memberTransportParamsSchema.parse(req.params);

    const transports = await transportService.getMemberTransport({
      groupId,
      memberId,
    });

    res.json({ transports });
  }
);

export const handleTransportChat = httpHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { groupId } = groupParamsSchema.parse(req.params);
    const { message } = transportChatSchema.parse(req.body);

    const payload = await transportChatService.handleMessage({
      userId: req.user!.id, // req.user is guaranteed to be present due to requireAuth middleware
      groupId,
      message,
    });

    res.json({
      message: payload.message,
      status: payload.status,
      pendingAction: payload.pendingAction,
      options: payload.options,
      createdItemId: payload.createdItemId,
    });
  }
);

export const getTransportChatHistory = httpHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { groupId } = groupParamsSchema.parse(req.params);

    const history = await transportChatService.getHistory({
      userId: req.user!.id, // req.user is guaranteed to be present due to requireAuth middleware
      groupId,
    });

    res.json({ history });
  }
);
