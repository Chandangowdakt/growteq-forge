"use client"

import { useState, useEffect } from "react"
import { Building2, Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Organization {
  id: string
  name: string
  code: string
}

interface OrganizationSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onOrganizationSelect: (organization: Organization) => void
  selectedOrganization?: Organization
}

const organizations: Organization[] = [
  { id: "1", name: "JPCL", code: "JP" },
  { id: "2", name: "JSPL", code: "JS" },
]

export function OrganizationSelectorModal({
  isOpen,
  onClose,
  onOrganizationSelect,
  selectedOrganization: selectedOrganizationProp,
}: OrganizationSelectorModalProps) {
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | undefined>(
    selectedOrganizationProp,
  )

  useEffect(() => {
    setSelectedOrganization(selectedOrganizationProp)
  }, [selectedOrganizationProp])

  const handleOrganizationClick = (organization: Organization) => {
    setSelectedOrganization(organization)
  }

  const handleConfirm = () => {
    if (selectedOrganization) {
      onOrganizationSelect(selectedOrganization)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-[#3E2C80]">
            <Building2 className="h-5 w-5" />
            <span>Select Organization for Acme Corporation</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-600 mb-4">
            Please select an organization to continue with Acme Corporation
          </p>

          <div className="grid grid-cols-2 gap-3">
            {organizations.map((organization) => (
              <button
                key={organization.id}
                onClick={() => handleOrganizationClick(organization)}
                className={`
                  relative flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all
                  ${
                    selectedOrganization?.id === organization.id
                      ? "border-[#3E2C80] bg-[#3E2C80]/5"
                      : "border-gray-200 hover:border-[#3E2C80]/50 hover:bg-gray-50"
                  }
                `}
              >
                {selectedOrganization?.id === organization.id && (
                  <div className="absolute top-2 right-2 bg-[#3E2C80] rounded-full p-1">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
                <div className="text-2xl font-bold text-[#3E2C80] mb-2">{organization.code}</div>
                <div className="text-sm font-medium text-gray-900">{organization.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="text-gray-600 bg-transparent">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedOrganization}
            className="bg-[#3E2C80] hover:bg-[#3E2C80]/90 text-white"
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
