import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { proposalsApi } from '@/lib/api'
import PickProposalClient from './pick-proposal-client'

export default async function PickProposalPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = (await getSession())!
  const { id } = await params
  const data = await proposalsApi.get(id, session.token).catch(() => null)
  if (!data) notFound()

  return (
    <PickProposalClient
      proposal={data.proposal}
      schedules={data.schedules}
      token={session.token}
      serverNowMs={Date.now()}
    />
  )
}
