import { loadPageData } from "@/lib/page-data";
import { AssistantView } from "@/components/assistant/AssistantView";

type Props = { searchParams: Promise<{ tag?: string; life?: string }> };

export default async function AssistantPage({ searchParams }: Props) {
  const data = await loadPageData(searchParams);
  return (
    <AssistantView
      stats={data.stats}
      birthDate={data.birthDate}
      lifeSpanYears={data.lifeSpanYears}
    />
  );
}
