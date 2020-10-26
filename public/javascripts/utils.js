const hasOwn = Object.prototype.hasOwnProperty

const ajaxPost = async function (url = '', data = {}) {
    const response = await fetch(url, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })

    return await response.json()
}

const boundNumber = function (value, min, max) {
    return Math.min(max, Math.max(parseInt(value, 10), min))
}

const arrayRandom = function (arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

const noop = function () {}

const normalizeString = function (value) {
    return String(value).toLowerCase().replace(/[^\w]/g, '')
}


const querySelectorFrom = function (selector, elements) {
    return [].filter.call(elements, function(element) {
        return element.matches(selector)
    })
}

const formatSince = (date) => {
    const elapsedTime = Date.now() - date

    const seconds = elapsedTime / 1000
    const minutes = seconds / 60
    const hours = minutes / 60
    const days = hours / 24

    let format = ''

    if (minutes <= 1) {
        format = 'just now'
    } else if (hours <= 1) {
        format = Math.floor(minutes) + ' minutes ago'
    } else if (days <= 1) {
        if (hours < 2) {
            format = '1 hour ago'
        } else {
            format = Math.floor(hours) + ' hours ago'
        }
    } else {
        if (days > 2) {
            format = Math.floor(days) + ' days ago'
        } else {
            const dayHours = hours % 24

            if (dayHours <= 2) {
                format = '1 day ago'
            } else {
                format = '1 day and ' + Math.floor(dayHours) + ' hours ago'
            }
            
        }
    }

    return format
}
