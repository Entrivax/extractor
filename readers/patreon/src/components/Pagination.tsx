import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "../../utils/query";

const pagesToShow = 5
const defaultPageParam = 'page'

export function Pagination({ pagesCount, pageParam = defaultPageParam }) {
    const params = useQuery()
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
    const params = new URLSearchParams(loc.search)
    params.set(pageParam, page)

    const targetLocation = {
        pathname: loc.pathname,
        search: `?${params.toString()}`
    }

    return (
        <li>
            <NavLink isActive={(match, location) => location.pathname === targetLocation.pathname && location.search === targetLocation.search} to={targetLocation} replace className="text-(--action-color) cursor-pointer hover:text-(--action-hover-color) focus-visible:text-(--action-hover-color) active:text-(--action-active-color) aria-[current=page]:text-(--regular-muted-text-color) aria-[current=page]:pointer-events-none">
                { children }
            </NavLink>
        </li>
    )
}