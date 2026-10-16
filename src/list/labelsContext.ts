import React from 'react'
import { DEFAULT_LABELS, type ListLabels } from './labels'

export const LabelsContext = React.createContext<ListLabels>(DEFAULT_LABELS)

export const useLabels = () => React.useContext(LabelsContext)
