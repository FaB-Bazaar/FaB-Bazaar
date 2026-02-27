// DISABLED: Notification service temporarily removed
/*
/**
 * Notification Service Contract
 *
 * Database-agnostic interface for notification operations.
 * Handles trade notifications and inbox messaging.
 */

import type { AsyncResult } from './common';

// ====================================
// DTOs (Data Transfer Objects)
// ====================================

/**
 * Notification/Message DTO
 */
export interface NotificationDTO {
  _id: string;
  senderId: string;
  senderUsername: string;
  recipientId: string;
  recipientUsername: string;
  message: string;
  type: NotificationType;
  read: boolean;
  agreementId?: string;
  agreementStatus?: string;
  actionRequired?: boolean;
  actionType?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Notification types
 */
export type NotificationType =
  | 'trade_update'
  | 'message'
  | 'system'
  | 'announcement';

/**
 * Parameters for sending a trade notification
 */
export interface SendTradeNotificationDTO {
  agreementId: string;
  agreementStatus: string;
  recipientId: string;
  senderId?: string;
  message: string;
  actionRequired?: boolean;
  actionType?: string;
}

/**
 * Action message based on trade status
 */
export interface ActionMessageDTO {
  message: string;
  actionRequired: boolean;
  actionType: string;
}

// ====================================
// Service Interface
// ====================================

/**
 * Notification Service Interface
 *
 * Database-agnostic contract for notification operations.
 * All methods return AsyncResult<T> for consistent error handling.
 *
 * @example
 * ```typescript
 * // Send a trade notification
 * const result = await notificationService.sendTradeNotification({
 *   agreementId: 'trade123',
 *   agreementStatus: 'accepted',
 *   recipientId: 'user456',
 *   message: 'Trade has been accepted!'
 * });
 *
 * if (result.success) {
 *   console.log(`Notification sent: ${result.data._id}`);
 * }
 * ```
 */
export interface INotificationService {
  /**
   * Send a trade notification to a user
   *
   * Creates a notification message in the recipient's inbox
   * with trade-specific metadata.
   *
   * @param params - Trade notification parameters
   * @returns The created notification
   */
  sendTradeNotification(
    params: SendTradeNotificationDTO
  ): AsyncResult<NotificationDTO>;

  /**
   * Get action message based on trade status and user role
   *
   * This is a pure helper function that determines what action
   * the user should take based on the current trade status.
   * Note: This method is synchronous and does not access the database.
   *
   * @param status - The current trade status
   * @param userRole - Whether the user is the initiator or recipient
   * @returns Action message with required action details
   */
  getTradeActionMessage(
    status: string,
    userRole: 'initiator' | 'recipient'
  ): ActionMessageDTO;

  /**
   * Get user's notifications
   *
   * @param userId - The user ID
   * @param unreadOnly - If true, only return unread notifications
   * @returns List of notifications
   */
  getUserNotifications(
    userId: string,
    unreadOnly?: boolean
  ): AsyncResult<NotificationDTO[]>;

  /**
   * Mark a notification as read
   *
   * @param notificationId - The notification ID
   * @param userId - The user ID (for ownership verification)
   * @returns Success status
   */
  markAsRead(
    notificationId: string,
    userId: string
  ): AsyncResult<boolean>;

  /**
   * Mark all user's notifications as read
   *
   * @param userId - The user ID
   * @returns Count of notifications marked as read
   */
  markAllAsRead(
    userId: string
  ): AsyncResult<{ count: number }>;
}
*/

// Stub exports for disabled feature
export interface NotificationDTO {
  _id: string;
  senderId: string;
  senderUsername: string;
  recipientId: string;
  recipientUsername: string;
  message: string;
  type: NotificationType;
  read: boolean;
  agreementId?: string;
  agreementStatus?: string;
  actionRequired?: boolean;
  actionType?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export type NotificationType =
  | 'trade_update'
  | 'message'
  | 'system'
  | 'announcement';

export interface SendTradeNotificationDTO {
  agreementId: string;
  agreementStatus: string;
  recipientId: string;
  senderId?: string;
  message: string;
  actionRequired?: boolean;
  actionType?: string;
}

export interface ActionMessageDTO {
  message: string;
  actionRequired: boolean;
  actionType: string;
}

export interface INotificationService {}
