"use client"

import { useState, useEffect } from "react"
import { ChevronDown, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LocationSelectorModal } from "./location-selector-modal"
import { OrganizationSelectorModal } from "./organization-selector-modal"
import Image from "next/image"

interface Customer {
  id: string
  name: string
  code: string
  logo: string
}

interface Location {
  id: string
  name: string
  code: string
  flag: string
}

interface Organization {
  id: string
  name: string
  code: string
}

interface CustomerSelectorProps {
  customers?: Customer[]
  selectedCustomer?: Customer
  onCustomerChange?: (customer: Customer, location?: Location, organization?: Organization) => void
}

const defaultCustomers: Customer[] = [
  { id: "1", name: "Acme Corporation", code: "ACME", logo: "/images/acme-logo.png" },
  { id: "2", name: "Global Industries", code: "GLOB", logo: "/images/global-industrial-logo.png" },
  { id: "3", name: "Tech Solutions Ltd", code: "TECH", logo: "/images/tech-solutions-logo.png" },
  { id: "4", name: "Manufacturing Co", code: "MANU", logo: "/images/manufacturing-logo.png" },
]

export function CustomerSelector({
  customers = defaultCustomers,
  selectedCustomer = defaultCustomers[0],
  onCustomerChange,
}: CustomerSelectorProps) {
  const [selected, setSelected] = useState<Customer>(selectedCustomer)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [isOrganizationModalOpen, setIsOrganizationModalOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | undefined>()
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | undefined>()

  useEffect(() => {
    if (selectedCustomer) {
      setSelected(selectedCustomer)
    }
  }, [selectedCustomer])

  const handleCustomerSelect = (customer: Customer) => {
    if (customer.code === "GLOB") {
      setSelected(customer)
      setSelectedOrganization(undefined)
      setIsLocationModalOpen(true)
    } else if (customer.code === "ACME") {
      setSelected(customer)
      setSelectedLocation(undefined)
      setIsOrganizationModalOpen(true)
    } else {
      setSelected(customer)
      setSelectedLocation(undefined)
      setSelectedOrganization(undefined)
      onCustomerChange?.(customer)
    }
  }

  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location)
    onCustomerChange?.(selected, location, undefined)
  }

  const handleOrganizationSelect = (organization: Organization) => {
    setSelectedOrganization(organization)
    onCustomerChange?.(selected, undefined, organization)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center space-x-2 bg-white border-gray-200 hover:bg-gray-50 text-gray-700 min-w-[140px] px-3 py-2"
          >
            <div className="h-6 w-6 relative flex-shrink-0">
              <Image
                src={selected.logo || "/placeholder.svg"}
                alt={selected.name}
                fill
                className="object-contain"
              />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] text-gray-500 leading-tight">Customer:</span>
              <span className="text-xs font-medium leading-tight">
                {selected.code}
                {selected.code === "GLOB" && selectedLocation && (
                  <span className="ml-1">{selectedLocation.flag}</span>
                )}
                {selected.code === "ACME" && selectedOrganization && (
                  <span className="ml-1 text-[#3E2C80]">({selectedOrganization.code})</span>
                )}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {customers.map((customer) => (
            <DropdownMenuItem
              key={customer.id}
              onClick={() => handleCustomerSelect(customer)}
              className="flex items-center space-x-3 p-3"
            >
              <div className="h-10 w-10 relative flex-shrink-0">
                <Image
                  src={customer.logo || "/placeholder.svg"}
                  alt={customer.name}
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{customer.name}</span>
                <span className="text-[10px] text-gray-500">{customer.code}</span>
              </div>
              {customer.code === "GLOB" && <MapPin className="h-3 w-3 text-gray-400 ml-auto" />}
              {customer.code === "ACME" && (
                <div className="h-3 w-3 rounded-full bg-[#3E2C80]/10 flex items-center justify-center ml-auto">
                  <span className="text-[8px] text-[#3E2C80] font-bold">O</span>
                </div>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <LocationSelectorModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onLocationSelect={handleLocationSelect}
        selectedLocation={selectedLocation}
      />

      <OrganizationSelectorModal
        isOpen={isOrganizationModalOpen}
        onClose={() => setIsOrganizationModalOpen(false)}
        onOrganizationSelect={handleOrganizationSelect}
        selectedOrganization={selectedOrganization}
      />
    </>
  )
}
