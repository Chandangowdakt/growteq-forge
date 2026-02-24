"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

// Define the company type
export type Company = {
  id: string
  name: string
  logo: string
}

// Sample company data - in a real app, this would come from an API
const defaultCompanies = [
  { id: "1", name: "ITC Infotech", logo: "/images/nimble-color-large.svg" },
  { id: "2", name: "Globex Industries", logo: "/images/logo-collapsed-white.svg" },
  { id: "3", name: "Initech Solutions", logo: "/images/nimble-symbol-white.svg" },
  { id: "4", name: "Umbrella Corp", logo: "/images/nimble-color-large.svg" },
  { id: "5", name: "Stark Industries", logo: "/images/logo-collapsed-white.svg" },
]

type CompanyContextType = {
  companies: Company[]
  selectedCompany: Company
  setSelectedCompany: (company: Company) => void
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

interface CompanyProviderProps {
  children: ReactNode
}

export function CompanyProvider({ children }: CompanyProviderProps) {
  const [companies] = useState<Company[]>(defaultCompanies)
  const [selectedCompany, setSelectedCompanyState] = useState<Company>(defaultCompanies[0])

  const setSelectedCompany = useCallback((company: Company) => {
    setSelectedCompanyState(company)
  }, [])

  const contextValue: CompanyContextType = {
    companies,
    selectedCompany,
    setSelectedCompany,
  }

  return <CompanyContext.Provider value={contextValue}>{children}</CompanyContext.Provider>
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider")
  }
  return context
}
