/**
 * The herbarium's folio plates — the static knowledge corpus the Library
 * renders. Extracted from the page so the badge system (Profile) and the
 * plant-aware recommendations (libraryEngagement.folioMatchesForSpecies)
 * can count and match against the real corpus instead of a duplicated
 * constant that would silently drift.
 */
export interface PhytoNote {
  name: string;
  scientific: string;
  type: string;
  organ: string;
  symptoms: string;
  protocol: string;
  evidenceLevel: string;
  severity: string;
  prevalence: string;
  image: string;
}

export const PHYTO_NOTES: PhytoNote[] = [
  // Species Profile
  {
    name: "Monstera deliciosa",
    scientific: "Monstera deliciosa",
    type: "Species Profile",
    organ: "Whole Organism",
    symptoms: "Fenestration delay, yellowing edges (magnesium deficiency), aerial root desiccation.",
    protocol: "Maintain 18-30°C and 60%+ humidity. Wipe leaves monthly for high-efficiency photosynthesis. Use well-draining aroid mix (bark, perlite, coco coir) and provide a moss pole for climbing support.",
    evidenceLevel: "Validated (Botanical)",
    severity: "Low",
    prevalence: "Subtropical",
    image: "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Sansevieria trifasciata",
    scientific: "Dracaena trifasciata",
    type: "Species Profile",
    organ: "Rhizome/Leaf",
    symptoms: "Mushy base (overwatering), vertical wrinkling (severe dehydration), falling over (lack of light).",
    protocol: "Strict drought tolerance protocol. Water only when soil is 100% dry (every 14-30 days). Highly adaptable to low light but thrives in bright indirect light.",
    evidenceLevel: "Field-Tested",
    severity: "Low",
    prevalence: "Arid",
    image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Ficus lyrata",
    scientific: "Ficus lyrata",
    type: "Species Profile",
    organ: "Foliage",
    symptoms: "Browning spots with yellow rings (bacterial leaf spot), sudden leaf drop (drafts or relocation shock), edema (inconsistent watering).",
    protocol: "Stationary environment required. High indirect light. Specialized drainage mandatory. Water thoroughly then allow top 50% of soil to dry.",
    evidenceLevel: "Clinical Study",
    severity: "Moderate",
    prevalence: "Tropical",
    image: "https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Calathea orbifolia",
    scientific: "Goeppertia orbifolia",
    type: "Species Profile",
    organ: "Foliage",
    symptoms: "Crispy brown leaf margins (fluoride/chlorine sensitivity), leaf curling (low humidity or underwatering), faded patterns (too much sun).",
    protocol: "Use distilled or rainwater only. Filtered indirect light. Maintain strict moisture consistency—never allow to fully dry out. 60%+ humidity.",
    evidenceLevel: "Validated",
    severity: "High",
    prevalence: "South America",
    image: "https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Epipremnum aureum",
    scientific: "Epipremnum aureum",
    type: "Species Profile",
    organ: "Whole Organism",
    symptoms: "Loss of variegation (low light), yellowing oldest leaves (overwatering or nitrogen deficiency), stunted growth (root bound).",
    protocol: "Extremely resilient. Adaptable to low light but variegation requires bright indirect light. Propagates easily in water via nodes.",
    evidenceLevel: "Validated",
    severity: "Low",
    prevalence: "French Polynesia",
    image: "https://images.unsplash.com/photo-1598880940080-ff9a29891b85?q=80&w=600&auto=format&fit=crop"
  },
  
  // Pathology
  {
    name: "Powdery Mildew",
    scientific: "Erysiphales",
    type: "Pathology",
    organ: "Leaf/Stem",
    symptoms: "White, flour-like powder on leaves and stems; stunted growth, leaf distortion, and premature drop in advanced stages.",
    protocol: "Apply potassium bicarbonate or sulfur-based fungicide. Isolate specimen immediately. Improve air circulation and avoid wetting foliage during watering.",
    evidenceLevel: "Validated (Clinical)",
    severity: "Moderate",
    prevalence: "Global",
    image: "https://images.unsplash.com/photo-1520412099551-62b6bafeb5bb?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Root Rot",
    scientific: "Phytophthora / Pythium",
    type: "Pathology",
    organ: "Root System",
    symptoms: "Mushy, dark brown or black roots, putrid odor from soil, sudden wilting despite wet soil, yellowing lower leaves.",
    protocol: "Immediate emergency repotting. Excise all necrotic tissue with sterilized shears. Apply 3% hydrogen peroxide flush or copper fungicide drench. Repot in highly aerated dry mix.",
    evidenceLevel: "Validated (Clinical)",
    severity: "Critical",
    prevalence: "High Moisture Environments",
    image: "https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Bacterial Leaf Spot",
    scientific: "Xanthomonas campestris",
    type: "Pathology",
    organ: "Foliage",
    symptoms: "Water-soaked dark lesions with distinct yellow halos. Rapid spread across foliage in humid conditions. Leaves may turn completely yellow and drop.",
    protocol: "No cure for infected leaves; excise immediately and destroy. Apply copper-based bactericide to healthy foliage. Stop misting entirely.",
    evidenceLevel: "Clinical Study",
    severity: "High",
    prevalence: "Warm/Humid",
    image: "https://images.unsplash.com/photo-1611211232932-da3113c5b960?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Botrytis Blight",
    scientific: "Botrytis cinerea",
    type: "Pathology",
    organ: "Foliage/Flowers",
    symptoms: "Fuzzy gray mold on aging flowers or damaged leaves. Brown spots expanding rapidly in cool, damp conditions.",
    protocol: "Remove spent flowers and decaying leaves constantly. Increase airflow. Apply preventative fungicide (chlorothalonil).",
    evidenceLevel: "Validated",
    severity: "Moderate",
    prevalence: "Cool/Damp",
    image: "https://images.unsplash.com/photo-1477511801984-4ad318ed9846?q=80&w=600&auto=format&fit=crop"
  },

  // Pests
  {
    name: "Spider Mites",
    scientific: "Tetranychidae",
    type: "Pest",
    organ: "Leaf Underside",
    symptoms: "Microscopic stippling (tiny yellow dots), fine webbing near stems and undersides, overall dulling or yellowing of foliage.",
    protocol: "Systemic miticide or repeat applications of neem oil. Forceful water spray to dislodge. Significantly increase ambient humidity to deter reproduction.",
    evidenceLevel: "Field-Tested",
    severity: "High",
    prevalence: "Arid/Indoor Heating",
    image: "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Mealybugs",
    scientific: "Pseudococcidae",
    type: "Pest",
    organ: "Node/Leaf Axil",
    symptoms: "Cotton-like white fluffy clusters in crevices, sticky honeydew residue, sooty mold development, distorted new growth.",
    protocol: "Manual removal with 70% isopropyl alcohol-soaked swab. Follow with insecticidal soap or systemic imidacloprid. Check root systems as soil mealybugs exist.",
    evidenceLevel: "Field-Tested",
    severity: "High",
    prevalence: "Indoor/Tropical",
    image: "https://images.unsplash.com/photo-1591958911259-bee2173bdccc?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Fungus Gnats",
    scientific: "Sciaridae",
    type: "Pest",
    organ: "Root System/Soil",
    symptoms: "Tiny black flies near soil surface. Larvae feed on root hairs causing delayed growth, sudden wilting, or secondary root rot infections.",
    protocol: "Allow top 2 inches of soil to dry out completely. Apply BTI (Bacillus thuringiensis israelensis) via mosquito dunks in water. Use yellow sticky traps for adults.",
    evidenceLevel: "Validated",
    severity: "Low",
    prevalence: "Overwatered Soil",
    image: "https://images.unsplash.com/photo-1459156212016-c812468e2115?q=80&w=600&auto=format&fit=crop"
  },
  {
    name: "Thrips",
    scientific: "Thysanoptera",
    type: "Pest",
    organ: "Foliage",
    symptoms: "Silvery or bronze scarring on leaves, distorted new growth, tiny black fecal specks. Pests look like slender grains of rice.",
    protocol: "Extremely difficult to eradicate. Isolate immediately. Prune heavily damaged leaves. Alternate Spinosad and systemic insecticides weekly for 4 weeks.",
    evidenceLevel: "Expert Grade",
    severity: "Critical",
    prevalence: "Global",
    image: "https://images.unsplash.com/photo-1521334884684-d80222895322?q=80&w=600&auto=format&fit=crop"
  }
];
