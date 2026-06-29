export type SettlementBreakdown = {
  gross: number;
  commission: number;
  cardFees: number;
  cashCommissionDue: number;
  net: number;
};

export function parseSettlementBreakdown(
  settlement: Record<string, unknown>,
): SettlementBreakdown {
  return {
    gross: Number(settlement.gross_sales ?? 0),
    commission: Number(settlement.commission_amount ?? 0),
    cardFees: Number(settlement.card_processing_fees ?? 0),
    cashCommissionDue: Number(settlement.cash_orders_commission_due ?? 0),
    net: Number(settlement.net_payout ?? 0),
  };
}

/** net = gross − commission − card fees − cash commission due (within 1 cent). */
export function settlementMathConsistent(b: SettlementBreakdown): boolean {
  const expected = b.gross - b.commission - b.cardFees - b.cashCommissionDue;
  return Math.abs(b.net - expected) < 0.01;
}

export function formatSettlementLkr(n: number): string {
  return `Rs ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
