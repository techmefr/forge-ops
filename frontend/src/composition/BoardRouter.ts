import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type Router,
  type RouterHistory,
} from 'vue-router'
import { ABSORBED_PATHS, HOME_PATH } from '@/technical/Router/Screen.js'

const ABSORBED: readonly RouteRecordRaw[] = Object.entries(ABSORBED_PATHS).map(
  ([from, to]) => ({
    path: from,
    redirect: to,
  }),
)

export const ROUTES: readonly RouteRecordRaw[] = [
  { path: '/', redirect: HOME_PATH },
  { path: '/projects', redirect: '/projects/board' },
  {
    path: '/projects/:tab',
    name: 'projects',
    component: () => import('@/domain/Shell/ProjectsScreen.vue'),
  },
  { path: '/me', redirect: '/me/stories' },
  {
    path: '/me/stories/:id',
    name: 'personal.story',
    component: () => import('@/domain/Shell/PersonalScreen.vue'),
  },
  {
    path: '/me/:tab',
    name: 'personal',
    component: () => import('@/domain/Shell/PersonalScreen.vue'),
  },
  {
    path: '/statistics',
    name: 'statistics',
    component: () => import('@/domain/Statistic/StatisticScreen.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/domain/Setting/SettingScreen.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/domain/Access/LoginScreen.vue'),
  },
  {
    path: '/atelier/:id',
    redirect: (to) => `/me/stories/${String(to.params.id)}`,
  },
  ...ABSORBED,
  { path: '/:rest(.*)', redirect: HOME_PATH },
]

export function createBoardRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
): Router {
  return createRouter({ history, routes: [...ROUTES] })
}
