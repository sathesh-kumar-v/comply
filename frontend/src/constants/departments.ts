export const DEPARTMENT_OPTIONS = [
  "Compliance",
  "Legal",
  "Risk Management",
  "Quality Assurance",
  "Operations",
  "IT",
  "Executive",
  "Other"
] as const

export type DepartmentOption = (typeof DEPARTMENT_OPTIONS)[number]

export const OTHER_DEPARTMENT_VALUE: DepartmentOption = "Other"

export const isPredefinedDepartment = (value: string): boolean =>
  DEPARTMENT_OPTIONS.includes(value as DepartmentOption) && value !== OTHER_DEPARTMENT_VALUE
