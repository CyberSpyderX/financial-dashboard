"use client"
import { useGetSummary } from "@/features/summary/hooks/use-get-summary"
import { Chart, ChartLoading } from "@/components/chart";
import { CategoryChart, SpendingPieLoading } from "./categories-chart";

export const DataCharts = () => {
    const { data, isLoading } = useGetSummary();

    if(isLoading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-8">
                <div className="col-span-1 lg:col-span-3 xl:col-span-4">
                    <ChartLoading />
                </div>
                <div className="col-span-1 lg:col-span-3 xl:col-span-2">
                    <SpendingPieLoading />
                </div>
            </div>
        )
    }
    return (
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-8">
            <div className="col-span-1 lg:col-span-3 xl:col-span-4">
                <Chart data={data?.days} />
            </div>
            <div className="col-span-1 lg:col-span-3 xl:col-span-2">
                <CategoryChart data={data?.topCategories} />
            </div>
        </div>
    )
}