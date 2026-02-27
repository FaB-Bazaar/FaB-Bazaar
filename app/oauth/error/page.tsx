// app/oauth/error/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'unknown_error';
  const errorDescription = searchParams.get('error_description') || 'An unknown error occurred during authorization';
  const state = searchParams.get('state');
  
  // OAuth 2.1 standard error types with user-friendly descriptions
  const errorMessages: Record<string, string> = {
    invalid_request: 'The request is missing required parameters or is otherwise invalid.',
    invalid_client: 'The client credentials are invalid or the client is not found.',
    invalid_grant: 'The authorization grant is invalid, expired, or revoked.',
    unsupported_response_type: 'The response type is not supported by this server.',
    unsupported_grant_type: 'The grant type is not supported by this server.',
    access_denied: 'The user denied the authorization request.',
    server_error: 'An internal server error occurred.',
    temporarily_unavailable: 'The service is temporarily unavailable.',
    method_not_allowed: 'The HTTP method is not allowed for this endpoint.',
    invalid_scope: 'The requested scope is invalid or unknown.',
    invalid_redirect_uri: 'The redirect URI is invalid or not registered.',
    invalid_client_metadata: 'The client metadata is invalid.'
  };

  // Get user-friendly title based on error type
  const getErrorTitle = (errorType: string): string => {
    switch (errorType) {
      case 'invalid_client':
        return 'Client Not Found';
      case 'access_denied':
        return 'Access Denied';
      case 'invalid_request':
        return 'Invalid Request';
      case 'server_error':
        return 'Server Error';
      case 'unsupported_response_type':
      case 'unsupported_grant_type':
        return 'Unsupported Request';
      default:
        return 'Authorization Error';
    }
  };

  // Get appropriate icon for error type
  const getErrorIcon = (errorType: string) => {
    switch (errorType) {
      case 'access_denied':
        return (
          <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
          </svg>
        );
      case 'server_error':
        return (
          <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="h-6 w-6 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            {getErrorIcon(error)}
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {getErrorTitle(error)}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            OAuth 2.1 Authorization Error
          </p>
        </div>
        
        {/* Error Details */}
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              {getErrorIcon(error)}
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {error}
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{errorMessages[error] || errorDescription}</p>
                {errorDescription && errorMessages[error] && errorDescription !== errorMessages[error] && (
                  <p className="mt-2 text-xs text-red-600">
                    <strong>Details:</strong> {errorDescription}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* State Information */}
        {state && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  State Parameter
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p className="font-mono text-xs break-all">{state}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Troubleshooting Tips */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-gray-800 mb-2">
            Common Solutions
          </h3>
          <div className="text-sm text-gray-600 space-y-2">
            {error === 'invalid_client' && (
              <ul className="list-disc list-inside space-y-1">
                <li>Verify your client_id is correct</li>
                <li>Ensure the client is registered with this server</li>
                <li>Check that redirect_uri matches registered URIs</li>
              </ul>
            )}
            {error === 'access_denied' && (
              <ul className="list-disc list-inside space-y-1">
                <li>User declined to authorize the application</li>
                <li>User account may not have required permissions</li>
                <li>Try signing in with a different account</li>
              </ul>
            )}
            {error === 'invalid_request' && (
              <ul className="list-disc list-inside space-y-1">
                <li>Check that all required parameters are included</li>
                <li>Verify parameter values are correctly formatted</li>
                <li>Ensure PKCE code_challenge is provided</li>
              </ul>
            )}
            {(error === 'server_error' || error === 'temporarily_unavailable') && (
              <ul className="list-disc list-inside space-y-1">
                <li>Please try again in a few moments</li>
                <li>If the problem persists, contact support</li>
                <li>Check server status and connectivity</li>
              </ul>
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go Back
          </button>
          <a 
            href="/"
            className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Return to Home
          </a>
        </div>

        {/* Developer Info */}
        <div className="text-center text-xs text-gray-500">
          <p>FabBazaar OAuth 2.1 Authorization Server</p>
          <p className="mt-1">
            For support, visit{' '}
            <a href="/docs/oauth" className="text-indigo-600 hover:text-indigo-500">
              OAuth Documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OAuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading error details...</p>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}