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
      <Tabs defaultValue="committed" className="h-full gap-4">
        <CardHeader className="border-b">
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
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <TabsContent value="committed" className="flex min-h-64 flex-1 flex-col">
            <ChartContainer config={config} className="aspect-auto min-h-64 w-full flex-1">
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
                <Bar dataKey="committed" fill="var(--color-committed)" radius={0} maxBarSize={22} />
              </BarChart>
            </ChartContainer>
          </TabsContent>
          <TabsContent value="floor" className="flex min-h-64 flex-1 flex-col">
            <ChartContainer config={config} className="aspect-auto min-h-64 w-full flex-1">
              <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
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
                  strokeWidth={1.5}
                  fill="var(--color-cashFloor)"
                  fillOpacity={0.1}
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
