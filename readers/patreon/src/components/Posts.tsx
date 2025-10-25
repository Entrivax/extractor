import { Post, PostData } from "./Post"
import { Pagination } from "./Pagination"
import { useSearchParams } from "react-router-dom"

export type PostsData = {
	posts: PostData[]
}

const postsPerPage = 25
const pageParam = 'page'

export function Posts({ posts }: PostsData) {
	const [searchParams] = useSearchParams()
	
	const page = +(searchParams.get(pageParam) || '1');
	if (posts == null) {
		return null
	}
	const currentPagePosts = posts.slice((page - 1) * postsPerPage, page * postsPerPage)

	const pagesCount = Math.ceil(posts.length / postsPerPage)
	return <div class="flex flex-col gap-[24px]">
		<Pagination pageParam={pageParam} pagesCount={pagesCount} />
		<div class="flex flex-col gap-[24px]">
			{ currentPagePosts.map(post => <Post post={post} key={post.id} />) }
		</div>
		<Pagination pageParam={pageParam} pagesCount={pagesCount} />
	</div>
}