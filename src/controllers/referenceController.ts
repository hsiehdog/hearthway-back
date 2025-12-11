import { Request, Response } from "express";
import { AIRLINES_BY_CODE } from "../constants/airlines";

export const listAirlines = (_req: Request, res: Response): void => {
  const airlines = Object.values(AIRLINES_BY_CODE).sort((a, b) => a.name.localeCompare(b.name));
  res.json(airlines);
};
