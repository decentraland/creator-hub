import { useEffect, useMemo, useState } from 'react';
import communitiesApi, { type CommunityMinimal } from '/@/lib/communities';
import { useAuth } from '/@/hooks/useAuth';

export const useCommunities = (communityIds: string[]) => {
  const { wallet } = useAuth();
  const [resolved, setResolved] = useState<Map<string, CommunityMinimal>>(new Map());

  useEffect(() => {
    if (!wallet || communityIds.length === 0) {
      setResolved(new Map());
      return;
    }

    Promise.all(
      communityIds.map(id =>
        communitiesApi.fetchCommunity(wallet, id).then(result => ({ id, result })),
      ),
    ).then(results => {
      const next = new Map<string, CommunityMinimal>();
      for (const { id, result } of results) {
        if (result) next.set(id, result);
      }
      setResolved(next);
    });
  }, [communityIds.join(','), wallet]);

  const totalMembersCount = useMemo(() => {
    let total = 0;
    for (const community of resolved.values()) {
      total += community.membersCount;
    }
    return total;
  }, [resolved]);

  return { communities: resolved, totalMembersCount };
};
