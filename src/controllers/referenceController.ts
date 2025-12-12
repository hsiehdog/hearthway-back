import { Request, Response } from "express";
import { listAllAirlines } from "../constants/airlines";

export const listAirlines = (_req: Request, res: Response): void => {
  const airlines = listAllAirlines();
  res.json(airlines);
};
