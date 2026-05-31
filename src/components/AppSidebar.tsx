import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
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
import { ChevronsUpDown, LogOut, Settings, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ACTIVITY, CURRENT_USER, DATASETS, LAYERS, WORKSPACE } from '@/data/sample-workspace'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import dvcMark from '@/assets/dvc-mark.svg?inline'

export function AppSidebar() {
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
        <SidebarInput placeholder="Rechercher une couche…" />
      </SidebarHeader>

      <SidebarContent>
        <Tabs defaultValue="layers" className="px-2 pt-1">
          <TabsList className="w-full">
            <TabsTrigger value="layers" className="flex-1">
              Couches
            </TabsTrigger>
            <TabsTrigger value="data" className="flex-1">
              Données
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1">
              Activité
            </TabsTrigger>
          </TabsList>

          <TabsContent value="layers">
            <SidebarGroup className="p-0">
              <SidebarGroupLabel>Couches du projet</SidebarGroupLabel>
              <SidebarMenu>
                {LAYERS.map((layer) => (
                  <SidebarMenuItem key={layer.id}>
                    <SidebarMenuButton
                      isActive={layer.visible}
                      className={cn(!layer.visible && 'opacity-55')}
                    >
                      <layer.Icon className="size-4" />
                      <span>{layer.label}</span>
                      <Badge variant="secondary" className="ml-auto tabular-nums">
                        {layer.count.toLocaleString('fr-FR')}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </TabsContent>

          <TabsContent value="data">
            <SidebarGroup className="p-0">
              <SidebarGroupLabel>Jeux de données</SidebarGroupLabel>
              <SidebarMenu>
                {DATASETS.map((ds) => (
                  <SidebarMenuItem key={ds.id}>
                    <SidebarMenuButton size="lg">
                      <ds.Icon className="size-4" />
                      <span className="grid flex-1 leading-tight">
                        <span className="truncate font-medium">{ds.name}</span>
                        <span className="truncate text-xs text-muted-foreground tabular-nums">
                          {ds.records > 0
                            ? `${ds.records.toLocaleString('fr-FR')} objets · ${ds.updated}`
                            : `Service raster · ${ds.updated}`}
                        </span>
                      </span>
                      <Badge variant="outline" className="ml-auto">
                        {ds.format}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </TabsContent>

          <TabsContent value="activity">
            <SidebarGroup className="p-0">
              <SidebarGroupLabel>Activité récente</SidebarGroupLabel>
              <ul className="flex flex-col gap-3 px-2 py-1">
                {ACTIVITY.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[10px]">{item.initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid gap-0.5 text-xs leading-snug">
                      <p className="text-sidebar-foreground">
                        <span className="font-medium">{item.user}</span> {item.action}{' '}
                        <span className="font-medium">{item.target}</span>
                      </p>
                      <span className="text-muted-foreground">il y a {item.ago}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </SidebarGroup>
          </TabsContent>
        </Tabs>
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
