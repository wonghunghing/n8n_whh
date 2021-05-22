export const getOSDIResourceName = (response: any) => Object.keys(response['_embedded'])[0]

export const getOSDIData = (response: any, resourceName: string) => response['_embedded'][resourceName] as any[]

export const addOSDIMetadata = (item: any) => {
	// Try to give each item an ID dictionary for upstream work.
	// Particularly useful for pulling out the Action Network ID of an item for a further operation on it
	// e.g. find an event, get its ID and then sign someone up to it via its ID
	const identifierDictionary = createIdentifierDictionary(item?.identifiers as string[] || [])
	// Also provide IDs for related items mentioned in `links`
	// for downstream operations
	const relatedResourceIdentifiers = createRelatedResourcesIdentifierDictionary(item?._links || {})
	//
	return {
		...item,
		identifierDictionary: {
			self: identifierDictionary,
			...relatedResourceIdentifiers
		}
	}
}

// E.g. ["actionnetwork:asdasa-21321asdasd-sadada", "mailchimp:123124141"]
// Returns { actionnetwork: "asdasa-21321asdasd-sadada", mailchimp: 123124141 }
export const createIdentifierDictionary = (ids: string[] = []) => ids.reduce(
	(dict, id: string) => {
		try {
			const [prefix, ...suffixes] = id.split(':');
			dict[prefix] = suffixes.join('');
		} catch (e) {}
		return dict;
	},
	{} as { [source: string]: string }
)

export const createRelatedResourcesIdentifierDictionary = (links: object = {}) => Object.entries(links).reduce(
	(dict, [resourceName, link]: [string, any]) => {
		if (!link?.href || resourceName === 'curies') {
			return dict
		}
		try {
			const id = getResourceIDFromURL(resourceName as any, link?.href)
			if (!id || id.length === 0) {
				return dict
			}
			dict[resourceName] = { action_network: id }
		} catch (e) {}
		return dict
	},
	{} as { [resourceName: string]: { action_network: string } }
)

/**
 * Linking to resources
 */

const OSDIResources = {
	"osdi:person": {
		// "title": "The collection of people in the system",
		"href": "https://actionnetwork.org/api/v2/people"
	},
	"osdi:event": {
		// "title": "The collection of events in the system",
		"href": "https://actionnetwork.org/api/v2/events"
	},
	"osdi:petition": {
		// "title": "The collection of petitions in the system",
		"href": "https://actionnetwork.org/api/v2/petitions"
	},
	"osdi:fundraising_page": {
		// "title": "The collection of fundraising_pages in the system",
		"href": "https://actionnetwork.org/api/v2/fundraising_pages"
	},
	"osdi:donation": {
		// "title": "The collection of donations in the system",
		"href": "https://actionnetwork.org/api/v2/donations"
	},
	"osdi:query": {
		// "title": "The collection of queries in the system",
		"href": "https://actionnetwork.org/api/v2/queries"
	},
	"osdi:form": {
		// "title": "The collection of forms in the system",
		"href": "https://actionnetwork.org/api/v2/forms"
	},
	"action_network:event_campaign": {
		// "title": "The collection of event campaigns in the system",
		"href": "https://actionnetwork.org/api/v2/event_campaigns"
	},
	"action_network:campaign": {
		// "title": "The collection of campaigns in the system",
		"href": "https://actionnetwork.org/api/v2/campaigns"
	},
	"osdi:tag": {
		// "title": "The collection of tags in the system",
		"href": "https://actionnetwork.org/api/v2/tags"
	},
	"osdi:list": {
		// "title": "The collection of lists in the system",
		"href": "https://actionnetwork.org/api/v2/lists"
	},
	"osdi:wrapper": {
		// "title": "The collection of email wrappers in the system",
		"href": "https://actionnetwork.org/api/v2/wrappers"
	},
	"osdi:message": {
		// "title": "The collection of messages in the system",
		"href": "https://actionnetwork.org/api/v2/messages"
	},
	"osdi:person_signup_helper": {
		// "title": "Person Signup Helper",
		"href": "https://actionnetwork.org/api/v2/people"
	},
	"osdi:advocacy_campaign": {
		// "title": "The collection of advocacy_campaigns in the system",
		"href": "https://actionnetwork.org/api/v2/advocacy_campaigns"
	}
}

export const createResourceLink = (resourceName: keyof typeof OSDIResources, href: string) => {
	const urlPrefix = OSDIResources[resourceName].href!
	if (!href.startsWith(urlPrefix)) {
		href = `${urlPrefix}/${href}`
	}
	return {
		_links: { [resourceName]: {	href } }
	}
}

export const getResourceIDFromURL = (resourceName: keyof typeof OSDIResources, href: string) => {
	try {
		const urlPrefix = OSDIResources[resourceName].href!
		if (href.startsWith(urlPrefix)) {
			href = href.replace(urlPrefix, '').replace('/', '').replace('/', '').replace('/', '')
		}
		return href
	} catch (e) {
		throw new Error(`An ID could not be found for this URL, no matching resource: ${resourceName} ${href}`)
	}
}
