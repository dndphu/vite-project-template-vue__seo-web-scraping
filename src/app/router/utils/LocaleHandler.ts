import { ServerStore } from 'store/ServerStore'
import { RouteLocationNormalized, Router } from 'vue-router'

const fetchOnRoute = (() => {
	let controller

	return async (
		to: RouteLocationNormalized,
		init?: RequestInit | undefined
	): Promise<undefined | { statusCode: number; redirectUrl?: string }> => {
		if (!to) return

		controller?.abort('reject')
		controller = new AbortController()

		const data = await new Promise(async (res) => {
			setTimeout(() => {
				controller?.abort('reject')
				res(null)
			}, 1000)
			const response = await fetch(to.path, {
				...init,
				signal: controller.signal,
			}).then((res) => res.text())

			res(/^{(.|[\r\n])*?}$/.test(response) ? JSON.parse(response) : {})
		})

		return data as { statusCode: number; redirectUrl?: string }
	}
})() // fetchOnRoute

const VALID_CODE_LIST = [200]
const REDIRECT_CODE_LIST = [301, 302]
const ERROR_CODE_LIST = [404, 500, 502, 504]

const LocaleHandler = (() => {
	let curLocale: string
	let isAlreadyServerRedirect = false

	return async (
		router: Router,
		to: RouteLocationNormalized,
		from: RouteLocationNormalized
	) => {
		const defaultLocale = getLocale(
			LocaleInfo.defaultLang,
			LocaleInfo.defaultCountry
		)
		curLocale = getLocale(LocaleInfo.langSelected, LocaleInfo.countrySelected)

		if (
			// !isFinishServerChecking &&
			!isAlreadyServerRedirect &&
			window.location.pathname.replace(`/${curLocale}`, '') !==
				to.path.replace(`/${curLocale}`, '')
		) {
			// NOTE - Handle pre-render for bot with locale options turned on
			const data = await fetchOnRoute(to, {
				method: 'GET',
				headers: new Headers({
					Accept: 'application/json',
				}),
			})

			if (data) {
				if (REDIRECT_CODE_LIST.includes(data.statusCode)) {
					return {
						path: data.redirectUrl,
					}
				} else if (ERROR_CODE_LIST.includes(data.statusCode)) return false

				isAlreadyServerRedirect = true
			}

			ServerStore.reInit.LocaleInfo()
		}

		curLocale = getLocale(LocaleInfo.langSelected, LocaleInfo.countrySelected)

		console.log(!isAlreadyServerRedirect)

		// NOTE - Handle for hidden default locale params
		if (to.params.locale && curLocale !== to.params.locale) {
			// router.push({
			// 	path: `/${curLocale}${to.fullPath}`,
			// 	replace: !!window.history.state.forward,
			// })

			// return !!window.history.state.forward

			return {
				path: `/${curLocale}${to.fullPath}`,
				replace: !isAlreadyServerRedirect,
			}
		} else if (
			curLocale === defaultLocale &&
			to.params.locale &&
			LocaleInfo.hideDefaultLocale
		) {
			const path = to.fullPath.replace(`/${curLocale}`, '')

			return {
				path: path ? path : '/',
				name: to.name as string,
				params: {
					...to.params,
					locale: '',
				},
				replace: !isAlreadyServerRedirect,
			}
		}

		isAlreadyServerRedirect = false

		return
	}
})()

export default LocaleHandler
