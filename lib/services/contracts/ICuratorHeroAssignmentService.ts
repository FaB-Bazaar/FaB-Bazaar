import type { AsyncResult } from './common';

export interface CuratorHeroAssignmentDTO {
  userId: string;
  heroName: string;
  metafyProductUrl: string | null;
  metafyLinkLabel: string | null;
  username: string;
  displayUsername: string;
  avatarUrl: string | null;
}

export interface ICuratorHeroAssignmentService {
  getAssignmentsForUser(userId: string): AsyncResult<CuratorHeroAssignmentDTO[]>;
  getAssignmentsForHero(heroName: string): AsyncResult<CuratorHeroAssignmentDTO[]>;
  getAllAssignments(): AsyncResult<CuratorHeroAssignmentDTO[]>;
  assign(userId: string, heroName: string, metafyProductUrl?: string | null, metafyLinkLabel?: string | null): AsyncResult<void>;
  unassign(userId: string, heroName: string): AsyncResult<void>;
  updateMetafyLink(userId: string, heroName: string, metafyProductUrl: string | null, metafyLinkLabel?: string | null): AsyncResult<void>;
}
