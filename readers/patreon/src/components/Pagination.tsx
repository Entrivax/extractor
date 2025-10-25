import { useLocation, useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";

const pagesToShow = 5
const defaultPageParam = 'page'

export function Pagination({ pagesCount, pageParam = defaultPageParam }) {
    const [params] = useSearchParams()
    const currentPage = +(params.get(pageParam) || '1');
    if (pagesCount <= 1 && currentPage === 1) {
        return null;
    }
    const pages = []
    let startPage = Math.max(1, currentPage - Math.floor(pagesToShow / 2));
    let endPage = Math.min(pagesCount, startPage + pagesToShow - 1);

    for (let i = startPage; i <= endPage; i++) {
        pages.push(
            <PaginationBtn
                pageParam={pageParam}
                page={i}
                key={i}
            >
                {i}
            </PaginationBtn>
        );
    }
    return (
        <nav class="flex justify-center">
            <ul class="flex gap-x-1 items-center">
                { startPage > 1 && <PaginationBtn pageParam={pageParam} page={1}>First</PaginationBtn> }
                { pages }
                { endPage < pagesCount && <PaginationBtn pageParam={pageParam} page={pagesCount}>Last</PaginationBtn> }
            </ul>
        </nav>
    )
}

function PaginationBtn({ page, pageParam, children }) {
    const loc = useLocation()
    const [searchParams] = useSearchParams()
    const currentParams = new URLSearchParams(searchParams)
    if (!currentParams.get(pageParam)) {
        currentParams.set(pageParam, "1")
    }
    const params = new URLSearchParams(searchParams)
    params.set(pageParam, page)

    const targetLocation = {
        pathname: loc.pathname,
        search: `?${params.toString()}`
    }

    const isCurrent = loc.pathname === targetLocation.pathname && currentParams.toString() === params.toString()

    return (
        <li>
            <Link aria-current={isCurrent ? "page" : undefined} to={targetLocation} replace className="text-(--action-color) cursor-pointer hover:text-(--action-hover-color) focus-visible:text-(--action-hover-color) active:text-(--action-pressed-color) aria-[current=page]:text-(--regular-muted-text-color) aria-[current=page]:pointer-events-none">
                { children }
            </Link>
        </li>
    )
}