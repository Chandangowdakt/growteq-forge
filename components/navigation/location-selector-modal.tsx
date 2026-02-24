"use client"

import { useState, useEffect } from "react"
import { MapPin } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Location {
  id: string
  name: string
  code: string
  flag: string
}

interface LocationSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onLocationSelect: (location: Location) => void
  selectedLocation?: Location
}

const locations: Location[] = [
  { id: "1", name: "India", code: "IN", flag: "🇮🇳" },
  { id: "2", name: "Indonesia", code: "ID", flag: "🇮🇩" },
  { id: "3", name: "Singapore", code: "SG", flag: "🇸🇬" },
  { id: "4", name: "Malaysia", code: "MY", flag: "🇲🇾" },
  { id: "5", name: "Thailand", code: "TH", flag: "🇹🇭" },
  { id: "6", name: "Vietnam", code: "VN", flag: "🇻🇳" },
]

export function LocationSelectorModal({
  isOpen,
  onClose,
  onLocationSelect,
  selectedLocation: selectedLocationProp,
}: LocationSelectorModalProps) {
  const [selectedLocation, setSelectedLocation] = useState<Location | undefined>(selectedLocationProp)

  useEffect(() => {
    setSelectedLocation(selectedLocationProp)
  }, [selectedLocationProp])

  const handleLocationClick = (location: Location) => {
    setSelectedLocation(location)
  }

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-[#3E2C80]">
            <MapPin className="h-5 w-5" />
            <span>Select Location for Global Industries</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-600 mb-4">
            Please select a location to continue with Global Industries
          </p>

          <div className="grid grid-cols-2 gap-3">
            {locations.map((location) => (
              <button
                key={location.id}
                onClick={() => handleLocationClick(location)}
                className={`
                  flex items-center space-x-3 p-4 rounded-lg border-2 transition-all
                  ${
                    selectedLocation?.id === location.id
                      ? "border-[#3E2C80] bg-[#3E2C80]/5"
                      : "border-gray-200 hover:border-[#3E2C80]/50 hover:bg-gray-50"
                  }
                `}
              >
                <span className="text-2xl">{location.flag}</span>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium text-gray-900">{location.name}</span>
                  <span className="text-xs text-gray-500">{location.code}</span>
                </div>
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
            disabled={!selectedLocation}
            className="bg-[#3E2C80] hover:bg-[#3E2C80]/90 text-white"
          >
            Confirm Location
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
