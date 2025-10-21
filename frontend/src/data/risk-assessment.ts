import type { RiskAssessmentListItem, RiskDashboardData } from "@/types/risk"

type MockDashboardOptions = {
  riskType?: string
  dataSource?: string
}

const BASE_COUNTRY_ENTRIES = [
  {
    code: "US",
    name: "United States",
    score: 82,
    riskLevel: "Low" as const,
    trend: "Stable" as const,
    confidence: "High" as const,
    nextAssessment: "2024-08-05"
  },
  {
    code: "DE",
    name: "Germany",
    score: 76,
    riskLevel: "Low" as const,
    trend: "Improving" as const,
    confidence: "High" as const,
    nextAssessment: "2024-07-22"
  },
  {
    code: "IN",
    name: "India",
    score: 66,
    riskLevel: "Medium" as const,
    trend: "Improving" as const,
    confidence: "Medium" as const,
    nextAssessment: "2024-07-12"
  },
  {
    code: "BR",
    name: "Brazil",
    score: 58,
    riskLevel: "Medium" as const,
    trend: "Deteriorating" as const,
    confidence: "Medium" as const,
    nextAssessment: "2024-06-28"
  },
  {
    code: "ZA",
    name: "South Africa",
    score: 47,
    riskLevel: "High" as const,
    trend: "Deteriorating" as const,
    confidence: "Medium" as const,
    nextAssessment: "2024-06-19"
  },
  {
    code: "RU",
    name: "Russia",
    score: 38,
    riskLevel: "Critical" as const,
    trend: "Deteriorating" as const,
    confidence: "Low" as const,
    nextAssessment: "2024-05-30"
  },
  {
    code: "CN",
    name: "China",
    score: 64,
    riskLevel: "Medium" as const,
    trend: "Stable" as const,
    confidence: "Medium" as const,
    nextAssessment: "2024-07-02"
  }
]

const CATEGORY_TEMPLATES = [
  {
    id: 1,
    name: "Political Stability",
    weight: 20,
    baseline: 78
  },
  {
    id: 2,
    name: "Economic Outlook",
    weight: 20,
    baseline: 74
  },
  {
    id: 3,
    name: "Regulatory Environment",
    weight: 15,
    baseline: 70
  },
  {
    id: 4,
    name: "Corruption Index",
    weight: 10,
    baseline: 68
  },
  {
    id: 5,
    name: "Infrastructure Quality",
    weight: 10,
    baseline: 72
  },
  {
    id: 6,
    name: "Currency Stability",
    weight: 10,
    baseline: 66
  },
  {
    id: 7,
    name: "Trade Relations",
    weight: 10,
    baseline: 69
  },
  {
    id: 8,
    name: "Security Environment",
    weight: 5,
    baseline: 64
  }
]

const OFFLINE_ASSESSMENT_TEMPLATE: RiskAssessmentListItem[] = [
  {
    id: 101,
    title: "Global Political & Economic Heatmap",
    assessmentType: "Comprehensive Risk Assessment",
    status: "Active",
    startDate: "2024-02-01",
    endDate: "2024-05-31",
    nextAssessmentDue: "2024-07-30",
    totalCountries: 18,
    highRiskCountries: 4,
    assignedAssessor: "Sophia Martinez"
  },
  {
    id: 102,
    title: "Strategic Supply Chain Review",
    assessmentType: "Operational Risk Assessment",
    status: "In Review",
    startDate: "2024-01-15",
    endDate: "2024-04-30",
    nextAssessmentDue: "2024-06-15",
    totalCountries: 9,
    highRiskCountries: 2,
    assignedAssessor: "Daniel Carter"
  },
  {
    id: 103,
    title: "Quarterly Emerging Markets Pulse",
    assessmentType: "Economic Risk Assessment",
    status: "Planned",
    startDate: "2024-05-01",
    endDate: "2024-07-31",
    nextAssessmentDue: "2024-08-20",
    totalCountries: 12,
    highRiskCountries: 3,
    assignedAssessor: "Amina Hassan"
  }
]

function buildCountryCategories(multiplier: number) {
  return CATEGORY_TEMPLATES.map((category, index) => {
    const adjustment = Math.sin((multiplier + index) * 1.2) * 8
    const trend = adjustment > 2 ? "Improving" : adjustment < -2 ? "Deteriorating" : "Stable"
    return {
      id: category.id,
      name: category.name,
      score: Math.max(30, Math.min(95, Math.round(category.baseline + adjustment))),
      weight: category.weight,
      aiSuggestion: Math.max(30, Math.min(95, Math.round(category.baseline + adjustment / 2))),
      volatility: Math.abs(Math.round(adjustment)),
      trend
    }
  })
}

function buildSupportingSignals(score: number) {
  const normalized = score / 100
  return {
    economicMomentum: Number((0.4 + normalized * 0.3).toFixed(2)),
    governanceQuality: Number((0.45 + normalized * 0.25).toFixed(2)),
    geopoliticalStability: Number((0.35 + normalized * 0.28).toFixed(2))
  }
}

export function createMockDashboard(options: MockDashboardOptions = {}): RiskDashboardData {
  const riskType = options.riskType ?? "Overall"
  const dataSource = options.dataSource ?? "Combined"
  const generatedAt = new Date().toISOString()

  const countries = BASE_COUNTRY_ENTRIES.map((entry, index) => ({
    code: entry.code,
    name: entry.name,
    score: entry.score,
    riskLevel: entry.riskLevel,
    trend: entry.trend,
    confidence: entry.confidence,
    nextAssessment: entry.nextAssessment
  }))

  const highRiskCount = countries.filter((country) => country.riskLevel === "High" || country.riskLevel === "Critical").length

  const countryDetails = BASE_COUNTRY_ENTRIES.map((entry, index) => {
    const categories = buildCountryCategories(index + 1)
    const impactLevel = entry.riskLevel === "Critical" ? "Critical" : entry.riskLevel === "High" ? "High" : "Medium"
    const probabilityLevel = entry.trend === "Improving" ? "Possible" : entry.trend === "Stable" ? "Likely" : "Almost Certain"

    return {
      id: index + 1,
      countryCode: entry.code,
      countryName: entry.name,
      overallScore: entry.score,
      riskLevel: entry.riskLevel,
      trend: entry.trend,
      confidence: entry.confidence,
      impactLevel,
      probabilityLevel,
      evidence: `${entry.name} ${riskType.toLowerCase()} outlook synthesised from regional indicators and regulatory updates.`,
      comments: `Monitoring ${riskType.toLowerCase()} exposure alongside ${dataSource.toLowerCase()} intelligence feed.`,
      nextAssessmentDue: entry.nextAssessment,
      updateSource: "AI Baseline",
      lastUpdated: generatedAt,
      aiAlerts: entry.riskLevel === "Critical"
        ? ["Escalating sanctions exposure", "High volatility in commodity pricing"]
        : entry.riskLevel === "High"
          ? ["Currency stress testing recommended"]
          : ["Routine monitoring"],
      supportingSignals: buildSupportingSignals(entry.score),
      attachments: [],
      recentChange: entry.trend === "Improving" ? 4 : entry.trend === "Stable" ? 1 : -5,
      categories
    }
  })

  const nextAssessmentDue = countryDetails.reduce<string | undefined>((soonest, country) => {
    if (!country.nextAssessmentDue) return soonest
    if (!soonest) return country.nextAssessmentDue
    return new Date(country.nextAssessmentDue) < new Date(soonest) ? country.nextAssessmentDue : soonest
  }, undefined)

  return {
    generatedAt,
    filters: {
      riskType,
      dataSource
    },
    summary: {
      totalCountries: countries.length,
      highRiskCountries: highRiskCount,
      recentRiskChanges: 5,
      nextAssessmentDue
    },
    map: {
      countries,
      legend: [
        { label: "Low Risk", min: 75, max: 100, color: "#16a34a" },
        { label: "Moderate", min: 55, max: 74, color: "#f59e0b" },
        { label: "Elevated", min: 40, max: 54, color: "#f97316" },
        { label: "Critical", min: 0, max: 39, color: "#ef4444" }
      ]
    },
    aiInsights: {
      trendHighlights: [
        {
          country: "India",
          trend: "Growth indicators improving",
          predictedChange: 6,
          alerts: ["Monitor inflation pressure", "Supply chain stability improving"]
        },
        {
          country: "Brazil",
          trend: "Volatility across commodities",
          predictedChange: -4,
          alerts: ["Political landscape impacting compliance", "Watch currency hedging strategies"]
        },
        {
          country: "Germany",
          trend: "Strong regulatory resilience",
          predictedChange: 3,
          alerts: ["ESG obligations tightening", "Cyber readiness improving"]
        }
      ],
      regionalClusters: {
        "North America": {
          average_score: 81,
          high_risk_ratio: 0.08,
          improving_ratio: 0.62
        },
        Europe: {
          average_score: 73,
          high_risk_ratio: 0.12,
          improving_ratio: 0.58
        },
        "Asia Pacific": {
          average_score: 69,
          high_risk_ratio: 0.18,
          improving_ratio: 0.54
        },
        "Latin America": {
          average_score: 57,
          high_risk_ratio: 0.32,
          improving_ratio: 0.29
        }
      },
      watchlist: [
        {
          country: "Russia",
          riskLevel: "Critical",
          confidence: "Low",
          signals: {
            sanctionsExposure: 0.91,
            commodityShock: 0.88,
            geopoliticalRisk: 0.95
          }
        },
        {
          country: "South Africa",
          riskLevel: "High",
          confidence: "Medium",
          signals: {
            energyReliability: 0.73,
            regulatoryChange: 0.64,
            socialClimate: 0.69
          }
        },
        {
          country: "Brazil",
          riskLevel: "Medium",
          confidence: "Medium",
          signals: {
            currencyVolatility: 0.61,
            fiscalPressure: 0.57,
            complianceAlerts: 0.52
          }
        }
      ]
    },
    countryDetails
  }
}

export function getOfflineAssessments(): RiskAssessmentListItem[] {
  return OFFLINE_ASSESSMENT_TEMPLATE.map((assessment) => ({ ...assessment }))
}

export const MOCK_RISK_ASSESSMENTS = getOfflineAssessments()
