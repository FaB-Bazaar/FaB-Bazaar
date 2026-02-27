// DISABLED: Notifications feature temporarily removed
/*
// lib/notifications.ts
// NOTE: This file now uses the service layer - no direct mongoose access

import { notificationService } from '@/lib/services';

// System user ID for automated notifications
const SYSTEM_USER_ID = '000000000000000000000000';

/**
 * Send a trade notification to a user
 *
 * @deprecated Prefer using notificationService.sendTradeNotification() directly
 */
export async function sendTradeNotification({
  agreementId,
  agreementStatus,
  recipientId,
  senderId = SYSTEM_USER_ID,
  message,
  actionRequired = false,
  actionType = '',
}: {
  agreementId: string
  agreementStatus: string
  recipientId: string
  senderId?: string
  message: string
  actionRequired?: boolean
  actionType?: string
}) {
  // Parameters are typed as string, so pass them directly
  const result = await notificationService.sendTradeNotification({
    agreementId,
    agreementStatus,
    recipientId,
    senderId,
    message,
    actionRequired,
    actionType,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to send trade notification');
  }

  return result.data;
}

/**
 * Get action message based on agreement status and user role
 *
 * @deprecated Prefer using notificationService.getTradeActionMessage() directly
 */
export function getTradeActionMessage(
  status: string,
  userRole: 'initiator' | 'recipient'
): {
  message: string
  actionRequired: boolean
  actionType: string
} {
  return notificationService.getTradeActionMessage(status, userRole);
}
*/

// Stub exports for disabled feature
export async function sendTradeNotification(_params: any): Promise<any> {
  throw new Error('Feature disabled');
}

export function getTradeActionMessage(
  _status: string,
  _userRole: 'initiator' | 'recipient'
): {
  message: string
  actionRequired: boolean
  actionType: string
} {
  return { message: 'Feature disabled', actionRequired: false, actionType: '' };
}
