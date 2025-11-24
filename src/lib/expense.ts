import { Prisma, SplitType } from "@prisma/client";

type ExpenseWithParticipants = {
  amount: Prisma.Decimal | number | string;
  splitType: SplitType;
  participants: Array<{ memberId: string; shareAmount?: Prisma.Decimal | number | string | null }>;
};

export type ParticipantCostMap = Record<string, string>;

const toDecimal = (value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal => {
  if (value instanceof Prisma.Decimal) return value;
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  return new Prisma.Decimal(value);
};

export const calculateParticipantCosts = (expense: ExpenseWithParticipants): ParticipantCostMap => {
  const amount = toDecimal(expense.amount);
  const participants = expense.participants ?? [];

  if (!participants.length) {
    return {};
  }

  const shareCountsByMember: Record<string, Prisma.Decimal> = {};

  if (expense.splitType === SplitType.EVEN) {
    participants.forEach((participant) => {
      shareCountsByMember[participant.memberId] = new Prisma.Decimal(1);
    });
  } else if (expense.splitType === SplitType.PERCENT) {
    participants.forEach((participant) => {
      shareCountsByMember[participant.memberId] = toDecimal(participant.shareAmount);
    });
  } else if (expense.splitType === SplitType.SHARES) {
    participants.forEach((participant) => {
      shareCountsByMember[participant.memberId] = toDecimal(participant.shareAmount);
    });
  }

  const totalShares = Object.values(shareCountsByMember).reduce(
    (sum, share) => sum.plus(share),
    new Prisma.Decimal(0),
  );
  const evenShare = amount.div(participants.length);

  return participants.reduce<ParticipantCostMap>((acc, participant) => {
    const rawShare = shareCountsByMember[participant.memberId] ?? new Prisma.Decimal(0);
    let cost = evenShare;

    if (expense.splitType === SplitType.PERCENT && rawShare.gt(0)) {
      cost = amount.mul(rawShare).div(100);
    } else if (expense.splitType !== SplitType.PERCENT && totalShares.gt(0) && rawShare.gt(0)) {
      cost = amount.mul(rawShare).div(totalShares);
    }

    acc[participant.memberId] = cost.toFixed(2);
    return acc;
  }, {});
};

export const addParticipantCosts = <T extends ExpenseWithParticipants>(
  expense: T,
): T & { participantCosts: ParticipantCostMap } => {
  return {
    ...expense,
    participantCosts: calculateParticipantCosts(expense),
  };
};
