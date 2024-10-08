"use client";

import qs from "query-string";

import { 
    usePathname,
    useRouter,
    useSearchParams
} from "next/navigation";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import { useGetAccounts } from '@/features/accounts/hooks/use-get-accounts';
import { useGetSummary } from '@/features/summary/hooks/use-get-summary';

export const AccountFilter = () => {
    const router = useRouter();
    const params = useSearchParams();
    const pathname = usePathname();

    const accountId = params.get("accountId") || "all";
    const from = params.get("from") || "";
    const to = params.get("to") || "";


    const { data: accounts, isLoading: isAccountsLoading } = useGetAccounts();
    const { data: summary, isLoading: isSummaryLoading } = useGetSummary();

    const onChange = (newValue: string) => {
        const query = {
            accountId: newValue,
            from,
            to
        };

        if(newValue === 'all') {
            query.accountId = '';
        }

        const url = qs.stringifyUrl({
            url: pathname,
            query
        }, { skipNull: true, skipEmptyString: true });

        router.push(url);
    }

    return (
        <Select
            value={accountId}
            onValueChange={onChange}
            disabled={isAccountsLoading || isSummaryLoading }
        >
            <SelectTrigger
                className="lg:w-auto w-full h-9 rounded-md px-3 font-normal bg-white/10 hover:bg-white/20 hover:text-white border-none focus:ring-offset-0 focus:ring-transparent outline-none text-white transition focus:bg-white/30"
            >   
                <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">
                    All Accounts
                </SelectItem>
                {accounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                        {account.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}