import { useQuery } from '@tanstack/react-query'
import { getSetting } from '@/server/functions/settings'
import type { BackendType } from '@/server/services/backend'

export function useBackendSetting(): BackendType {
  const { data } = useQuery({
    queryKey: ['setting', 'generation_backend'],
    queryFn: () => getSetting({ data: 'generation_backend' }),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  })
  return (data as BackendType) ?? 'nai'
}
