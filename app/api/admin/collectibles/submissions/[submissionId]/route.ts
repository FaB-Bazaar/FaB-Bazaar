import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../../_auth';
import { collectibleService } from '@/lib/services';

/**
 * PATCH /api/admin/collectibles/submissions/[submissionId] — review a
 * crowdsourced submission (superadmin only). Body: { action: 'approve' |
 * 'reject' }. Approve applies the proposed fields to the catalog (create or
 * update); reject just closes the submission.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  let body: { action?: string } = {};
  try {
    body = await request.json();
  } catch {
    // fall through to validation below
  }

  const gate = await requireSuperAdmin(request, body);
  if (!gate.ok) return gate.response;

  if (body.action !== 'approve' && body.action !== 'reject') {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const { submissionId } = await params;
  const result =
    body.action === 'approve'
      ? await collectibleService.approveSubmission(submissionId, gate.userId)
      : await collectibleService.rejectSubmission(submissionId, gate.userId);

  if (!result.success) {
    const code =
      result.error === 'Submission not found' ? 404
      : result.error === 'Submission already reviewed' ? 409
      : 500;
    return NextResponse.json({ error: result.error }, { status: code });
  }

  return NextResponse.json({ success: true, data: result.data });
}
