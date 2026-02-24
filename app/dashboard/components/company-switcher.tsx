"use client"

import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, LogOut, Settings, User, Building } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SafeAvatar } from "@/components/ui/safe-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import { useCompany } from "@/app/context/company-context"
import type { Company } from "@/app/context/company-context"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2)
}

export function CompanySwitcher() {
  const router = useRouter()
  const { companies, selectedCompany, setSelectedCompany } = useCompany()
  const supplierName = "Shyam Prasad"
  const supplierInitials = getInitials(supplierName)

  const handleLogout = () => {
    router.push("/logout")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 rounded-full flex items-center gap-2">
          <SafeAvatar alt={supplierName} fallback={supplierInitials} className="h-8 w-8" />
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">{supplierName}</span>
            <span className="text-xs text-muted-foreground line-clamp-1 max-w-[120px]">
              {selectedCompany?.name}
            </span>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Company Information</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Building className="mr-2 h-4 w-4" />
            <span>{selectedCompany?.name}</span>
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Building className="mr-2 h-4 w-4" />
              <span>Change Company</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-56">
                {companies.map((company: Company) => (
                  <DropdownMenuItem key={company.id} onClick={() => setSelectedCompany(company)}>
                    <SafeAvatar src={company.logo} alt={company.name} className="mr-2 h-5 w-5" />
                    <span>{company.name}</span>
                    {selectedCompany.id === company.id && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
