import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ImportTable from "./ImportTable";
import { useState } from "react";
import { convertAmountToMiliUnits } from "@/lib/utils";
import { format, parse, isValid, parseISO, isAfter, isBefore } from "date-fns";

// Enhanced date format configurations
const DATE_FORMATS = {
  neo: 'MMM dd',
  scotia: 'M/d/yyyy',
  iso: 'yyyy-MM-dd',
  usShort: 'MM/dd/yy',
  usLong: 'MM/dd/yyyy',
  european: 'dd/MM/yyyy',
  dotted: 'MM.dd.yyyy',
  dashed: 'yyyy-MM-dd',
  natural: 'MMMM dd, yyyy'
} as const;

const OUTPUT_DATE_FORMAT = 'MMM dd, yyyy';

// Date validation constants
const MIN_VALID_YEAR = 1900;
const MAX_FUTURE_YEARS = 10;

type Props = {
    data: string[][];
    onCancel: () => void;
    onSubmit: (data: any) => void;
}

const requiredOptions = [
    "payee",
    "amount",
    "date"
] as const;

interface SelectedColumns {
    [key: string]: string | null;
}

interface ParsedTransaction {
    [key: string]: any;
    amount?: number;
    date?: string;
    payee?: string;
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

// Smart date parser that tries multiple formats
function parseDate(dateString: string, referenceYear?: number): Date | null {
    if (!dateString || typeof dateString !== 'string') return null;
    
    const cleanDate = dateString.trim();
    const currentYear = new Date().getFullYear();
    const refYear = referenceYear || currentYear;
    
    // Try parsing with different formats
    const formatAttempts = [
        // ISO format first (most reliable)
        () => {
            const isoDate = parseISO(cleanDate);
            return isValid(isoDate) ? isoDate : null;
        },
        // Try each predefined format
        ...Object.values(DATE_FORMATS).map(formatStr => () => {
            try {
                let parsedDate = parse(cleanDate, formatStr, new Date(refYear, 0, 1));
                
                // Handle year-less formats (like "MMM dd")
                if (formatStr === DATE_FORMATS.neo && isValid(parsedDate)) {
                    // For formats without year, use reference year or current year
                    parsedDate = new Date(refYear, parsedDate.getMonth(), parsedDate.getDate());
                }
                
                return isValid(parsedDate) ? parsedDate : null;
            } catch {
                return null;
            }
        }),
        // Try native Date parsing as fallback
        () => {
            const nativeDate = new Date(cleanDate);
            return isValid(nativeDate) ? nativeDate : null;
        }
    ];

    for (const attempt of formatAttempts) {
        const result = attempt();
        if (result && isValidDateRange(result)) {
            return result;
        }
    }

    return null;
}

// Validate date is within reasonable range
function isValidDateRange(date: Date): boolean {
    const currentDate = new Date();
    const minDate = new Date(MIN_VALID_YEAR, 0, 1);
    const maxDate = new Date(currentDate.getFullYear() + MAX_FUTURE_YEARS, 11, 31);
    
    return isAfter(date, minDate) && isBefore(date, maxDate);
}

// Smart amount parser
function parseAmount(amountString: string): number | null {
    if (!amountString || typeof amountString !== 'string') return null;
    
    // Remove common currency symbols and whitespace
    const cleaned = amountString
        .replace(/[$£€¥₹,\s]/g, '')
        .replace(/[()]/g, '') // Remove parentheses
        .trim();
    
    // Handle negative amounts in parentheses format
    const isNegative = amountString.includes('(') && amountString.includes(')');
    
    const numericValue = parseFloat(cleaned);
    
    if (isNaN(numericValue)) return null;
    
    return isNegative ? -Math.abs(numericValue) : numericValue;
}

// Validate transaction data
function validateTransactionData(data: ParsedTransaction[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (data.length === 0) {
        errors.push("No valid transactions found");
        return { isValid: false, errors, warnings };
    }
    
    let validTransactions = 0;
    let invalidDates = 0;
    let invalidAmounts = 0;
    
    data.forEach((transaction, index) => {
        let isValidTransaction = true;
        
        // Validate required fields
        if (!transaction.payee || transaction.payee.trim() === '') {
            warnings.push(`Transaction ${index + 1}: Missing payee`);
        }
        
        if (!transaction.date) {
            errors.push(`Transaction ${index + 1}: Invalid or missing date`);
            invalidDates++;
            isValidTransaction = false;
        }
        
        if (transaction.amount === undefined || transaction.amount === null) {
            errors.push(`Transaction ${index + 1}: Invalid or missing amount`);
            invalidAmounts++;
            isValidTransaction = false;
        }
        
        if (isValidTransaction) validTransactions++;
    });
    
    if (invalidDates > 0) {
        errors.push(`${invalidDates} transactions have invalid dates`);
    }
    
    if (invalidAmounts > 0) {
        errors.push(`${invalidAmounts} transactions have invalid amounts`);
    }
    
    if (validTransactions < data.length * 0.5) {
        errors.push("Less than 50% of transactions are valid");
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

// Detect likely date format from sample data
function detectDateFormat(dateStrings: string[]): string {
    const samples = dateStrings.slice(0, 10).filter(Boolean);
    const formatScores: Record<string, number> = {};
    
    Object.entries(DATE_FORMATS).forEach(([key, formatStr]) => {
        let successCount = 0;
        samples.forEach(dateStr => {
            try {
                const parsed = parse(dateStr.trim(), formatStr, new Date());
                if (isValid(parsed)) successCount++;
            } catch {
                // Ignore parsing errors
            }
        });
        formatScores[key] = successCount;
    });
    
    const bestFormat = Object.entries(formatScores)
        .sort(([,a], [,b]) => b - a)[0];
    
    return bestFormat ? bestFormat[0] : 'iso';
}

export default function ImportCard({ 
    data,
    onCancel,
    onSubmit,
}: Props) {
    const headers = data[0];
    const body = data.slice(1);
    const [selectedColumns, setSelectedColumns] = useState<SelectedColumns>({});
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    function onTableHeaderSelect(columnIndex: number, value: string | null) {
        setSelectedColumns((prev) => {
            const newSelectedColumns = { ...prev };

            // Clear any existing mapping for this value
            for (const key in newSelectedColumns) {
                if (newSelectedColumns[key] === value) {
                    newSelectedColumns[key] = null;
                }
            }

            if (value === 'skip') {
                value = null;
            }

            newSelectedColumns[`column_${columnIndex}`] = value;
            return newSelectedColumns;
        });
        
        // Clear validation when columns change
        setValidationResult(null);
    }

    async function handleContinue() {
        setIsProcessing(true);
        
        try {
            // Map the raw data according to selected columns
            const mappedData = {
                headers: headers.map((_item, index) => {
                    return selectedColumns[`column_${index}`] || null;
                }),
                body: body.map((row) => {
                    const transformedRow = row.map((cell, index) => {
                        return selectedColumns[`column_${index}`] ? cell : null
                    });

                    return transformedRow.every(item => item === null)
                        ? []
                        : transformedRow;
                }).filter((row) => row.length > 0)
            };
            
            // Convert to objects
            const arrayOfData = mappedData.body.map((row) => {
                return row.reduce((acc: any, value, index) => {
                    const header = mappedData.headers[index];
                    
                    if (header !== null && value !== null) {
                        acc[header] = value;
                    }
                    return acc;
                }, {});
            });

            // Detect date format from sample data
            const dateColumnIndex = headers.findIndex((_, index) => 
                selectedColumns[`column_${index}`] === 'date'
            );
            
            let detectedFormat = 'iso';
            if (dateColumnIndex !== -1) {
                const dateSamples = body.map(row => row[dateColumnIndex]).filter(Boolean);
                detectedFormat = detectDateFormat(dateSamples);
            }
            
            console.log(`Detected date format: ${detectedFormat}`);
            
            // Process and validate data
            const processedData: ParsedTransaction[] = arrayOfData.map((item) => {
                const processed: ParsedTransaction = { ...item };
                
                // Parse amount
                if (item.amount) {
                    const parsedAmount = parseAmount(item.amount);
                    if (parsedAmount !== null) {
                        processed.amount = convertAmountToMiliUnits(parsedAmount);
                    }
                }
                
                // Parse date with smart detection
                if (item.date) {
                    const parsedDate = parseDate(item.date);
                    if (parsedDate) {
                        processed.date = format(parsedDate, OUTPUT_DATE_FORMAT);
                    }
                }
                
                return processed;
            });
            
            // Validate the processed data
            const validation = validateTransactionData(processedData);
            setValidationResult(validation);
            
            if (validation.isValid) {
                onSubmit(processedData);
            }
            
        } catch (error) {
            console.error('Error processing import data:', error);
            setValidationResult({
                isValid: false,
                errors: ['An unexpected error occurred while processing the data'],
                warnings: []
            });
        } finally {
            setIsProcessing(false);
        }
    }

    const progress = Object.values(selectedColumns).filter(Boolean).length;
    const canContinue = progress >= requiredOptions.length && !isProcessing;

    return (
        <div className="max-w-screen-2xl mx-auto">
            <Card className="border-none drop-shadow-sm -mt-24">
                <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle className="text-xl line-clamp-1">
                        Import Transactions
                    </CardTitle>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                            size={'sm'} 
                            onClick={onCancel} 
                            variant="outline"
                            className="w-full sm:w-auto"
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button> 
                        <Button
                            size={"sm"}
                            className="w-full sm:w-auto"
                            onClick={handleContinue}
                            disabled={!canContinue}
                        >
                            {isProcessing ? 'Processing...' : `Continue (${Math.min(progress, requiredOptions.length)} / ${requiredOptions.length})`}
                        </Button>                    
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    
                    <ImportTable
                        headers={headers}
                        body={body}
                        selectedColumns={selectedColumns}
                        onTableHeaderSelect={onTableHeaderSelect}
                    />
                </CardContent>
            </Card>
        </div>
    );
}