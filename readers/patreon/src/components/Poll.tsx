export type PollData = {
    closes_at: string;
    created_at: string;
    num_responses: number;
    question_text: string;
    choices: {
        isSelected: boolean;
        num_responses: number;
        text_content: string;
    }[]
}

export function Poll({ poll }: { poll: PollData }) {
    if (!poll) {
        return null;
    }

    return (
        <div class="flex flex-col gap-[12px]">
            <div class="flex flex-col gap-[8px]">
                { poll.choices.map(choice => (
                    <div class="flex justify-between items-center relative bg-(--primary-subtle-color) overflow-hidden rounded-xl py-[8px] px-[12px]">
                        <div class="absolute bg-(--primary-subtle-color) inset-y-0 left-0 progress" style={{ width: (100 * choice.num_responses / poll.num_responses) + '%' }}></div>
                        <div class="z-10">
                            { choice.text_content }
                        </div>
                        <div class="z-10">
                            { choice.num_responses }
                        </div>
                    </div>
                )) }
            </div>
            <div class="text-(--regular-muted-text-color) text-sm">Poll ended { poll.closes_at } • { poll.num_responses } vote{poll.num_responses !== 1 ? 's' : ''} total</div>
        </div>
    )
}