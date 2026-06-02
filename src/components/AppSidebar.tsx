import { useRef, useState } from 'react'
import type { ComponentType } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Activity,
  ChevronsUpDown,
  Columns2,
  Database,
  Flame,
  Globe2,
  Layers,
  LogOut,
  Map,
  Ruler,
  Settings,
  Timer,
  Upload,
  UserRound,
  Users,
} from 'lucide-react'
import { CURRENT_USER, DATASETS, LAYERS, WORKSPACE } from '@/data/sample-workspace'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { useSidebarReveal } from '@/hooks/animations/useSidebarReveal'
import dvcMark from '@/assets/dvc-mark.svg?inline'

type NavItem = {
  id: string
  label: string
  Icon: ComponentType<{ className?: string }>
  badge?: number
}

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Atelier',
    items: [
      { id: 'map', label: 'Carte', Icon: Map },
      { id: 'layers', label: 'Couches', Icon: Layers, badge: LAYERS.length },
      { id: 'data', label: 'Jeux de données', Icon: Database, badge: DATASETS.length },
      { id: 'import', label: 'Imports', Icon: Upload },
    ],
  },
  {
    label: 'Analyses',
    items: [
      { id: 'measure', label: 'Mesure & dessin', Icon: Ruler },
      { id: 'isochrone', label: 'Isochrones', Icon: Timer },
      { id: 'heatmap', label: 'Densité', Icon: Flame },
      { id: 'swipe', label: 'Comparaison', Icon: Columns2 },
    ],
  },
  {
    label: 'Espace de travail',
    items: [
      { id: 'team', label: 'Équipe', Icon: Users },
      { id: 'activity', label: 'Activité', Icon: Activity },
      { id: 'publications', label: 'Publications', Icon: Globe2 },
      { id: 'settings', label: 'Paramètres', Icon: Settings },
    ],
  },
]

export function AppSidebar() {
  const contentRef = useRef<HTMLDivElement>(null)
  useSidebarReveal(contentRef)

  const [active, setActive] = useState('map')

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-open:bg-sidebar-accent">
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <img src={dvcMark} alt="" className="size-4" />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">{WORKSPACE.name}</span>
                <span className="truncate text-xs text-muted-foreground">{WORKSPACE.plan}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Espaces de travail</DropdownMenuLabel>
            <DropdownMenuItem>{WORKSPACE.name}</DropdownMenuItem>
            <DropdownMenuItem>Atlas Urbain</DropdownMenuItem>
            <DropdownMenuItem>Bac à sable</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <SidebarInput placeholder="Rechercher…" />
      </SidebarHeader>

      <SidebarContent ref={contentRef}>
        {NAV.map((group) => (
          <SidebarGroup key={group.label} data-reveal>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={active === item.id}
                    onClick={() => setActive(item.id)}
                  >
                    <item.Icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.badge != null && (
                    <SidebarMenuBadge className="tabular-nums">{item.badge}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">Apparence</span>
              <AnimatedThemeToggler
                id="gp-theme-toggle"
                duration={650}
                aria-label="Basculer le thème clair / sombre"
                title="Thème clair / sombre"
                className="inline-flex size-8 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground transition-colors hover:bg-sidebar-accent [&_svg]:size-4"
              />
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-open:bg-sidebar-accent">
                  <span className="relative">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        {CURRENT_USER.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
                  </span>
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-semibold">{CURRENT_USER.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {CURRENT_USER.role}
                    </span>
                  </span>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="grid leading-tight">
                    <span className="truncate font-semibold">{CURRENT_USER.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {CURRENT_USER.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <UserRound />
                    Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings />
                    Préférences
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
