"use client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Play, CheckCircle, Circle, Settings } from "lucide-react"

interface WelcomeModalProps {
  isOpen: boolean
  onClose: () => void
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const steps = [
    {
      number: 1,
      title: "System Configuration",
      description: "Configure system management settings",
      completed: true,
      href: "/dashboard/placeholder",
    },
  ]

  const completedSteps = steps.filter((step) => step.completed).length
  const totalSteps = steps.length
  const progressPercentage = (completedSteps / totalSteps) * 100

  const handleStepClick = (href: string) => {
    window.location.href = href
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold text-gray-900">Setup Progress</DialogTitle>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              {completedSteps} of {totalSteps} setup steps completed
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">{Math.round(progressPercentage)}% Complete</p>
          </div>
        </DialogHeader>

        <div className="space-y-3 my-4">
          {steps.map((step) => (
            <div
              key={step.number}
              className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                step.completed
                  ? "border-green-200 bg-green-50 hover:border-green-300"
                  : "border-gray-200 hover:border-blue-300"
              }`}
              onClick={() => handleStepClick(step.href)}
            >
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs ${
                  step.completed ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                }`}
              >
                {step.number}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-sm ${step.completed ? "text-green-900" : "text-gray-900"}`}>
                  {step.title}
                </h3>
                <p className={`text-xs leading-relaxed ${step.completed ? "text-green-600" : "text-gray-600"}`}>
                  {step.description}
                </p>
              </div>
              {step.completed ? (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {completedSteps < totalSteps ? (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4">
            <div className="text-center">
              <p className="text-sm text-gray-700 mb-3">
                Complete the remaining {totalSteps - completedSteps} step{totalSteps - completedSteps > 1 ? "s" : ""} to
                finish your setup
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2">
                <Play className="w-3 h-3 mr-2" />
                Watch Setup Guide
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 mb-4">
            <div className="text-center">
              <p className="text-sm text-green-700 mb-3 font-medium">🎉 Congratulations! Your setup is complete.</p>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <Button onClick={onClose} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 text-sm">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
