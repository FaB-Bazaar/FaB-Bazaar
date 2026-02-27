import React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ArrowRight } from "lucide-react"
import Image from "next/image"

interface ProposalItem {
  inventoryId: string;
  printingId: string;
  display_name: string;
  image_url: string;
  quantity: number;
  unitValue: number;
}

interface TradeProposal {
  _id: string;
  initiatorItems: ProposalItem[];
  recipientItems: ProposalItem[];
}

interface UserData {
  _id: string;
  username: string;
}

interface ConfirmTradeModalProps {
  show: boolean;
  proposal: TradeProposal;
  initiatorData: UserData | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const getNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null) {
    if ('$numberDouble' in value) return parseFloat(value.$numberDouble);
    if ('$numberInt' in value) return parseInt(value.$numberInt, 10);
    if ('$numberLong' in value) return parseInt(value.$numberLong, 10);
  }
  return 0;
};

export function ConfirmTradeModal({ 
  show, 
  proposal, 
  initiatorData, 
  onConfirm, 
  onCancel, 
  isLoading = false 
}: ConfirmTradeModalProps) {
  const youGive = proposal.recipientItems.reduce((sum, item) => 
    sum + (getNumber(item.unitValue) * getNumber(item.quantity)), 0
  );
  const youReceive = proposal.initiatorItems.reduce((sum, item) => 
    sum + (getNumber(item.unitValue) * getNumber(item.quantity)), 0
  );

  const difference = youReceive - youGive;

  return (
    <Dialog open={show} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Confirm Trade Execution
          </DialogTitle>
          <DialogDescription>
            This will immediately execute the trade and transfer ownership of all cards. 
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning Badge */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Immediate Trade Execution</span>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Cards will be transferred immediately. Both parties will receive their cards in new trade binders.
            </p>
          </div>

          {/* Trade Summary */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="text-sm text-red-700 dark:text-red-300 mb-1">You Give</div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                ${youGive.toFixed(2)}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">
                {proposal.recipientItems.length} item{proposal.recipientItems.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col justify-center">
              <ArrowRight className="h-6 w-6 mx-auto text-gray-500 mb-2" />
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Net Difference</div>
              <div className={`text-sm font-semibold ${
                Math.abs(difference) < 0.01 
                  ? 'text-gray-700 dark:text-gray-300' 
                  : difference > 0 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {Math.abs(difference) < 0.01 
                  ? 'Even' 
                  : `${difference > 0 ? '+' : ''}$${difference.toFixed(2)}`
                }
              </div>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-sm text-green-700 dark:text-green-300 mb-1">You Receive</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                ${youReceive.toFixed(2)}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                {proposal.initiatorItems.length} item{proposal.initiatorItems.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Card Previews */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">
                Cards You're Giving to {initiatorData?.username}
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {proposal.recipientItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-950/20 rounded">
                    <Image
                      src={item.image_url || '/cardback.webp'}
                      alt={item.display_name}
                      width={30}
                      height={42}
                      className="rounded border"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.display_name}</p>
                      <p className="text-xs text-gray-500">
                        {getNumber(item.quantity)}x @ ${getNumber(item.unitValue).toFixed(2)} each
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">
                Cards You're Receiving from {initiatorData?.username}
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {proposal.initiatorItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-950/20 rounded">
                    <Image
                      src={item.image_url || '/cardback.webp'}
                      alt={item.display_name}
                      width={30}
                      height={42}
                      className="rounded border"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.display_name}</p>
                      <p className="text-xs text-gray-500">
                        {getNumber(item.quantity)}x @ ${getNumber(item.unitValue).toFixed(2)} each
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Final Warning */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              By clicking "Execute Trade", you confirm that you want to proceed with this card exchange.
              <br />
              <strong>This action cannot be reversed.</strong>
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? "Executing Trade..." : "Execute Trade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}