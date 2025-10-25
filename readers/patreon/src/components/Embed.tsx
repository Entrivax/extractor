import { useState } from "preact/hooks";
import { useLinks } from "../../utils/strings";
import { useSearchParams } from "react-router-dom";

export type EmbedData = {
    url: string;
    provider: string;
    provider_url: string;
    subject: string;
    description: string;
    html: string;
    imageUrl: string;
}

export function Embed({ data }: { data: EmbedData }) {
    const [searchParams] = useSearchParams()
    const { cleanLink } = useLinks((searchParams.get('base') || null) as string | null)
    const [showEmbed, setShowEmbed] = useState(false)
    if (!isLink(data.html)) {
        if (!data.html) {
            return (
                <div class="p-[16px]">Missing link (probably due to unsufficient permissions during the backup)</div>
            )
        }
        if (!showEmbed) {
            return (
                <button class="w-full cursor-pointer relative" onClick={() => setShowEmbed(true)}>
                    <img class="w-full min-h-16 object-cover object-center" src={data.imageUrl} alt={data.subject} />
                    <div class="absolute inset-0 opacity-25 bg-black"></div>
                    <div class="absolute inset-0 flex items-center justify-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play-icon lucide-play w-8 h-8"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                    </div>
                </button>
            )
        }
        return (
            <div class="[&_iframe]:w-full" dangerouslySetInnerHTML={{ __html: data.html }}></div>
        )
    }
    return (
        <a class="border border-(--border-muted-color) rounded-[8px] flex mt-[16px] mx-[16px] overflow-auto items-stretch" href={data.url} target="_blank" rel="noopener noreferrer">
            <img class="w-24 object-cover object-center" src={cleanLink(data.html)} />
            <div class="p-[16px] flex flex-col shrink grow overflow-hidden max-w-full">
                <h3 class="font-semibold overflow-ellipsis overflow-hidden whitespace-nowrap">{data.subject}</h3>
                <div class="overflow-ellipsis overflow-hidden whitespace-nowrap">{data.description}</div>
                <div class="overflow-ellipsis overflow-hidden whitespace-nowrap">{data.url}</div>
            </div>
        </a>
    )
}

function isLink(str: string): boolean {
    try {
        new URL(str);
        return true;
    } catch (e) {
        return false;
    }
}