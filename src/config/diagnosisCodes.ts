export type DiagnosisCodeMeta = {
  description: string
  clinicTypes: string[]
  careCategory: string
  visitType: string
}

export const DIAGNOSIS_CODES: Record<string, DiagnosisCodeMeta> = {
  // Pediatrics — Well Visit
  'Z38.00':  { description: 'Newborn (Liveborn Infant)',                       clinicTypes: ['pediatrics'],                                  careCategory: 'Well Visit',      visitType: 'Well Child' },
  'Z00.110': { description: 'Newborn Exam (under 8 days)',                      clinicTypes: ['pediatrics'],                                  careCategory: 'Well Visit',      visitType: 'Well Child' },
  'Z00.111': { description: 'Newborn Exam (8–28 days)',                         clinicTypes: ['pediatrics'],                                  careCategory: 'Well Visit',      visitType: 'Well Child' },
  'Z00.121': { description: 'Routine Child Exam (with abnormal findings)',      clinicTypes: ['pediatrics'],                                  careCategory: 'Well Visit',      visitType: 'Well Child' },
  'Z00.129': { description: 'Routine Child Exam (no abnormal findings)',        clinicTypes: ['pediatrics'],                                  careCategory: 'Well Visit',      visitType: 'Well Child' },
  // Pediatrics — Immunization
  'Z23':     { description: 'Immunization Visit',                               clinicTypes: ['pediatrics'],                                  careCategory: 'Immunization',    visitType: 'Immunization Visit' },
  // Pediatrics — Screening
  'Z13.4':   { description: 'Developmental Screening',                          clinicTypes: ['pediatrics'],                                  careCategory: 'Screening',       visitType: 'Developmental Screening' },
  'Z13.5':   { description: 'Vision Screening',                                 clinicTypes: ['pediatrics'],                                  careCategory: 'Screening',       visitType: 'Vision Screening' },
  'Z13.89':  { description: 'Behavioral/Other Screening',                       clinicTypes: ['pediatrics'],                                  careCategory: 'Screening',       visitType: 'Behavioral Screening' },
  // Pediatrics — Sick Visit
  'J06.9':   { description: 'Upper Respiratory Infection',                      clinicTypes: ['pediatrics', 'family_medicine', 'general'],    careCategory: 'Sick Visit',      visitType: 'Sick Visit' },
  'H66.90':  { description: 'Ear Infection (Otitis Media)',                     clinicTypes: ['pediatrics'],                                  careCategory: 'Sick Visit',      visitType: 'Sick Visit' },
  'J02.9':   { description: 'Sore Throat',                                      clinicTypes: ['pediatrics'],                                  careCategory: 'Sick Visit',      visitType: 'Sick Visit' },
  'R50.9':   { description: 'Fever',                                            clinicTypes: ['pediatrics'],                                  careCategory: 'Sick Visit',      visitType: 'Sick Visit' },
  'K52.9':   { description: 'Gastroenteritis',                                  clinicTypes: ['pediatrics'],                                  careCategory: 'Sick Visit',      visitType: 'Sick Visit' },
  'P59.9':   { description: 'Neonatal Jaundice',                                clinicTypes: ['pediatrics'],                                  careCategory: 'Sick Visit',      visitType: 'Sick Visit' },
  // Pediatrics — Follow-up / Chronic
  'J45.909': { description: 'Asthma',                                           clinicTypes: ['pediatrics', 'family_medicine'],               careCategory: 'Follow-up',       visitType: 'Follow-up Visit' },
  'F90.9':   { description: 'ADHD',                                             clinicTypes: ['pediatrics', 'behavioral_health'],             careCategory: 'Follow-up',       visitType: 'Follow-up Visit' },
  'L20.9':   { description: 'Eczema',                                           clinicTypes: ['pediatrics'],                                  careCategory: 'Follow-up',       visitType: 'Follow-up Visit' },
  'P07.30':  { description: 'Preterm Birth',                                    clinicTypes: ['pediatrics'],                                  careCategory: 'Follow-up',       visitType: 'Follow-up Visit' },
  // Pediatrics — Sports Physical
  'Z02.5':   { description: 'Pre-participation Sports Physical',                clinicTypes: ['pediatrics'],                                  careCategory: 'Sports Physical', visitType: 'Sports Physical' },
  // Family Medicine — Well Visit
  'Z00.00':  { description: 'Annual Wellness Exam',                             clinicTypes: ['family_medicine', 'general'],                  careCategory: 'Well Visit',      visitType: 'Well Visit' },
  // Family Medicine — Follow-up / Chronic
  'I10':     { description: 'Hypertension',                                     clinicTypes: ['family_medicine', 'general'],                  careCategory: 'Follow-up',       visitType: 'Follow-up Visit' },
  'E11.9':   { description: 'Type 2 Diabetes',                                  clinicTypes: ['family_medicine', 'general'],                  careCategory: 'Follow-up',       visitType: 'Follow-up Visit' },
  'M54.5':   { description: 'Back Pain',                                        clinicTypes: ['family_medicine'],                             careCategory: 'Sick Visit',      visitType: 'Office Visit' },
  'J30.9':   { description: 'Allergic Rhinitis',                                clinicTypes: ['family_medicine', 'general'],                  careCategory: 'Sick Visit',      visitType: 'Office Visit' },
  // Family Medicine — Prenatal
  'Z34.12':  { description: 'Prenatal Care',                                    clinicTypes: ['family_medicine'],                             careCategory: 'Prenatal',        visitType: 'Prenatal Visit' },
  // Behavioral Health — Mental Health
  'F32.9':   { description: 'Major Depression',                                 clinicTypes: ['behavioral_health', 'pediatrics'],             careCategory: 'Mental Health',   visitType: 'Mental Health Visit' },
  'F41.1':   { description: 'Generalized Anxiety',                              clinicTypes: ['behavioral_health'],                           careCategory: 'Mental Health',   visitType: 'Mental Health Visit' },
  'F43.10':  { description: 'PTSD',                                             clinicTypes: ['behavioral_health'],                           careCategory: 'Mental Health',   visitType: 'Mental Health Visit' },
  'F20.9':   { description: 'Schizophrenia',                                    clinicTypes: ['behavioral_health'],                           careCategory: 'Mental Health',   visitType: 'Mental Health Visit' },
  'F31.9':   { description: 'Bipolar Disorder',                                 clinicTypes: ['behavioral_health'],                           careCategory: 'Mental Health',   visitType: 'Mental Health Visit' },
  'R45.851': { description: 'Suicidal Ideation',                                clinicTypes: ['behavioral_health'],                           careCategory: 'Mental Health',   visitType: 'Mental Health Visit' },
  'F10.20':  { description: 'Alcohol Use Disorder',                             clinicTypes: ['behavioral_health'],                           careCategory: 'Mental Health',   visitType: 'Mental Health Visit' },
}
