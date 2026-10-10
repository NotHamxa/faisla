"use client";
// Two honest views of the next 12 months: payments already committed, and the cash floor if no sales came in.
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { axisLakh, type ProjectionPoint } from "@/lib/dashboard";
import { formatPKR } from "@/lib/format";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const config = {
  committed: { label: "Committed payments", color: "var(--chart-1)" },
  cashFloor: { label: "Cash floor (no sales)", color: "var(--chart-2)" },
} satisfies ChartConfig;

function MoneyRow({ name, value }: { name: string; value: number }) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <span className="text-muted-foreground">{name}</span>
      <span className="font-mono font-medium text-foreground tabular-nums">{formatPKR(value)}</span>
    </div>
  );
}

export function CashChart({ data, monthlyFixedCosts }: { data: ProjectionPoint[]; monthlyFixedCosts: number }) {
  const totalCommitted = data.reduce((s, p) => s + p.committed, 0);
  const firstShort = data.find((p) => p.cashFloor < 0);

  return (
    <Card className="h-full">
      <Tabs defaultValue="committed" className="gap-4">
        <CardHeader>
          <CardTitle>Next 12 months</CardTitle>
          <CardDescription>
            <TabsContent value="committed">
              <span className="font-mono tabular-nums">{formatPKR(totalCommitted)}</span> committed to decided purchases
            </TabsContent>
            <TabsContent value="floor">
              {firstShort
                ? `With no sales, cash runs out in ${firstShort.label}. A floor, not a forecast.`
                : "With no sales, cash stays positive all year."}
            </TabsContent>
          </CardDescription>
          <CardAction>
            <TabsList>
              <TabsTrigger value="committed">Payments</TabsTrigger>
              <TabsTrigger value="floor">Cash floor</TabsTrigger>
            </TabsList>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TabsContent value="committed">
            <ChartContainer config={config} className="aspect-auto h-64 w-full">
              <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={axisLakh} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      formatter={(value) => <MoneyRow name="Committed" value={Number(value)} />}
                    />
                  }
                />
                <Bar dataKey="committed" fill="var(--color-committed)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          </TabsContent>
          <TabsContent value="floor">
            <ChartContainer config={config} className="aspect-auto h-64 w-full">
              <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
                <defs>
                  <linearGradient id="fillCashFloor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-cashFloor)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-cashFloor)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={axisLakh} />
                <ReferenceLine y={0} stroke="var(--destructive)" strokeDasharray="4 4" />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      formatter={(value) => <MoneyRow name="Cash at month end" value={Number(value)} />}
                    />
                  }
                />
                <Area
                  dataKey="cashFloor"
                  type="linear"
                  stroke="var(--color-cashFloor)"
                  strokeWidth={2}
                  fill="url(#fillCashFloor)"
                />
              </AreaChart>
            </ChartContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              Starts from cash in bank, less upfront payments; each month subtracts fixed costs (
              <span className="font-mono tabular-nums">{formatPKR(monthlyFixedCosts)}</span>) and committed payments.
            </p>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
