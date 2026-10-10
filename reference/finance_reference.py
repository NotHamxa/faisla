"""Recompute the Faisla demo numbers with the corrected finance method."""

taxRate = 0.29
discYear = 0.15
discYearAfterTax = discYear * (1 - taxRate)
cash0 = 1_00_00_000
fixedCosts = 35_00_000
lifeYears = 10
initialAllowance = 0.25
deprRate = 0.15


def monthly(yearly):
    return (1 + yearly) ** (1 / 12) - 1


def hiddenRate(price, inst, n, due=False):
    lo, hi = 0.0, 0.2
    for _ in range(200):
        r = (lo + hi) / 2
        start = 0 if due else 1
        pv = sum(inst / (1 + r) ** t for t in range(start, start + n))
        if pv > price:
            lo = r
        else:
            hi = r
    return r


def emi(p, yearly, n):
    i = yearly / 12
    return p * i * (1 + i) ** n / ((1 + i) ** n - 1)


def deprSchedule(cost):
    """Yearly tax depreciation: 25% initial allowance + 15% reducing balance, rest written off in final year."""
    out = []
    wdv = cost
    for y in range(1, lifeYears + 1):
        d = 0.0
        if y == 1:
            ia = cost * initialAllowance
            d += ia
            wdv -= ia
        if y == lifeYears:
            d += wdv
            wdv = 0
        else:
            nd = wdv * deprRate
            d += nd
            wdv -= nd
        out.append(d)
    return out


def option(name, cost, upfront, payments, markupByMonth=None):
    """payments: dict month -> amount (month>=1). markupByMonth: dict month -> markup."""
    flows = {0: upfront}
    for m, a in payments.items():
        flows[m] = flows.get(m, 0) + a
    d = monthly(discYear)
    pvPre = sum(a / (1 + d) ** m for m, a in flows.items())

    # After tax: savings arrive at year end (months 12, 24, ...)
    taxFlows = dict(flows)
    markupYear = {}
    for m, mk in (markupByMonth or {}).items():
        y = (m - 1) // 12 + 1
        markupYear[y] = markupYear.get(y, 0) + mk
    for y, mk in markupYear.items():
        taxFlows[12 * y] = taxFlows.get(12 * y, 0) - mk * taxRate
    for y, dep in enumerate(deprSchedule(cost), start=1):
        taxFlows[12 * y] = taxFlows.get(12 * y, 0) - dep * taxRate
    da = monthly(discYearAfterTax)
    pvPost = sum(a / (1 + da) ** m for m, a in taxFlows.items())
    pvPostNoDepr = sum(
        a / (1 + da) ** m for m, a in flows.items()
    ) - sum(mk * taxRate / (1 + da) ** (12 * y) for y, mk in markupYear.items())

    monthlyPay = payments.get(1, 0)
    runway = (cash0 - upfront) / (fixedCosts + monthlyPay)
    return dict(name=name, pvPre=pvPre, pvPost=pvPost, pvPostNoDepr=pvPostNoDepr,
                runway=runway, monthlyPay=monthlyPay)


def loanOption(name, price, yearly, n=36, down=0.10):
    p = price * (1 - down)
    e = emi(p, yearly, n)
    bal = p
    markup = {}
    for m in range(1, n + 1):
        mk = bal * yearly / 12
        markup[m] = mk
        bal -= e - mk
    return option(name, price, price * down, {m: e for m in range(1, n + 1)}, markup), e, p


if __name__ == "__main__":
    r = hiddenRate(55_20_000, 5_00_000, 12)
    rDue = hiddenRate(55_20_000, 5_00_000, 12, due=True)
    print(f"hidden rate arrears: {r*100:.4f}%/m  {((1+r)**12-1)*100:.2f}%/yr")
    print(f"hidden rate due:     {rDue*100:.4f}%/m  {((1+rDue)**12-1)*100:.2f}%/yr")
    print(f"after-tax discount yearly {discYearAfterTax*100:.2f}%  monthly {monthly(discYearAfterTax)*100:.4f}%")
    print(f"pre-tax monthly d {monthly(discYear)*100:.4f}%")

    rows = [
        option("A installments", 60_00_000, 0, {m: 5_00_000 for m in range(1, 13)}),
        option("A cash", 55_20_000, 55_20_000, {}),
        option("B cash", 53_60_000, 53_60_000, {}),
    ]
    bank, eBank, p = loanOption("B bank 14.8%", 53_60_000, 0.148)
    ltff, eLtff, _ = loanOption("B LTFF 8.5%", 53_60_000, 0.085)
    bankStress, eStress, _ = loanOption("B bank 16.8%", 53_60_000, 0.168)
    rows += [bank, ltff, bankStress]
    print(f"P={p:,.0f} EMI bank={eBank:,.2f} LTFF={eLtff:,.2f} stress={eStress:,.2f}")
    for row in rows:
        print(f"{row['name']:16} pre={row['pvPre']:>13,.0f} post={row['pvPost']:>13,.0f} "
              f"postNoDepr={row['pvPostNoDepr']:>13,.0f} runway={row['runway']:.2f} pay={row['monthlyPay']:,.0f}")
    print("depr 53.6L:", [round(x) for x in deprSchedule(53_60_000)])
