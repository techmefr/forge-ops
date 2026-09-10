import { createRouter, createWebHistory, type RouteRecordRaw, type Router, type RouterHistory } from 'vue-router'
import { HOME_PATH } from './Screen.js'

export const ROUTES: readonly RouteRecordRaw[] = [
  { path: '/', redirect: HOME_PATH },
  { path: '/story', name: 'story', component: () => import('@/domain/Story/StoryScreen.vue') },
  { path: '/story/:id', name: 'story.one', component: () => import('@/domain/Story/StoryScreen.vue') },
  { path: '/backlog', name: 'backlog', component: () => import('@/domain/Backlog/BacklogScreen.vue') },
  {
    path: '/architecture',
    name: 'architecture',
    component: () => import('@/domain/Architecture/ArchitectureScreen.vue'),
  },
  { path: '/kanban', name: 'kanban', component: () => import('@/domain/Kanban/KanbanScreen.vue') },
  { path: '/project', name: 'project', component: () => import('@/domain/File/FileScreen.vue') },
  { path: '/review', name: 'review', component: () => import('@/domain/Review/ReviewScreen.vue') },
  { path: '/view', name: 'view', component: () => import('@/domain/View/ViewScreen.vue') },
  {
    path: '/deployment',
    name: 'deployment',
    component: () => import('@/domain/Deployment/DeploymentScreen.vue'),
  },
  { path: '/resources', name: 'resources', component: () => import('@/domain/Resource/ResourceScreen.vue') },
  {
    path: '/statistics',
    name: 'statistics',
    component: () => import('@/domain/Statistic/StatisticScreen.vue'),
  },
  { path: '/incidents', name: 'incidents', component: () => import('@/domain/Incident/IncidentScreen.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/domain/Setting/SettingScreen.vue') },
  { path: '/login', name: 'login', component: () => import('@/domain/Access/LoginScreen.vue') },
  { path: '/:rest(.*)', redirect: HOME_PATH },
]

export function createBoardRouter(history: RouterHistory = createWebHistory()): Router {
  return createRouter({ history, routes: [...ROUTES] })
}
