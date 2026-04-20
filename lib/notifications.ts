// DISABLED: Notifications feature temporarily removed
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
