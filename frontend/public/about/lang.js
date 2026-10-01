;(function () {
  var LANGUAGES = ['fr', 'en', 'de', 'es', 'it', 'pt', 'zh']
  var KEY = 'forge.about.language'
  var dictionary = window.ABOUT_I18N || {}

  function stored() {
    try {
      return window.localStorage.getItem(KEY)
    } catch (_error) {
      return null
    }
  }

  function remember(language) {
    try {
      window.localStorage.setItem(KEY, language)
    } catch (_error) {
      return
    }
  }

  function negotiated() {
    var preferred = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'fr'])
    for (var i = 0; i < preferred.length; i += 1) {
      var base = String(preferred[i]).toLowerCase().split('-')[0]
      if (LANGUAGES.indexOf(base) !== -1) {
        return base
      }
    }
    return 'fr'
  }

  function apply(language) {
    var words = dictionary[language]
    if (!words) {
      return
    }
    document.documentElement.lang = language
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      var text = words[node.getAttribute('data-i18n')]
      if (text !== undefined) {
        node.innerHTML = text
      }
    })
    document.querySelectorAll('[data-i18n-alt]').forEach(function (node) {
      var text = words[node.getAttribute('data-i18n-alt')]
      if (text !== undefined) {
        node.setAttribute('alt', text)
      }
    })
    document.querySelectorAll('[data-i18n-label]').forEach(function (node) {
      var text = words[node.getAttribute('data-i18n-label')]
      if (text !== undefined) {
        node.setAttribute('aria-label', text)
      }
    })
    if (words.title) {
      document.title = words.title
    }
    var meta = document.querySelector('meta[name="description"]')
    if (meta && words.description) {
      meta.setAttribute('content', words.description)
    }
    var select = document.getElementById('lang')
    if (select) {
      select.value = language
    }
  }

  var first = stored()
  var language = LANGUAGES.indexOf(first) !== -1 ? first : negotiated()
  apply(language)

  var select = document.getElementById('lang')
  if (select) {
    select.addEventListener('change', function () {
      remember(select.value)
      apply(select.value)
    })
  }
})()
