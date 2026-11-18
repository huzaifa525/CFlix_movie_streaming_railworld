"""Converts Adblock Plus filter lists into WebKit content blocker rules.

Usage: blocklist.py OUTPUT_DIR SITE_DIR LIST [LIST ...]

WebKit only understands part of what ad blockers do, so rules it can't express
(scriptlets, regular expressions, redirects and so on) are skipped. One invalid
rule makes WebKit reject a whole list, so anything unusual is skipped too.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

# WebKit allows 150,000 rules per list
MAX_RULES = 140000
SELECTORS_PER_RULE = 250

RESOURCE_TYPES = {
    'script': 'script',
    'image': 'image',
    'stylesheet': 'style-sheet',
    'font': 'font',
    'media': 'media',
    'subdocument': 'document',
    'xmlhttprequest': 'raw',
    'popup': 'popup',
    'ping': None,
    'websocket': None,
    'other': None,
}

DOMAIN = re.compile(r'[a-z0-9.-]+')
SAFE_SELECTOR = re.compile(r'''[A-Za-z0-9_\-#.\[\]="'^$*~|>+ (),:]+''')
ALLOWED_PSEUDO = re.compile(r':(not\(|first-child|last-child|only-child|nth-child\(|nth-of-type\()')
SELECTOR_NAMES = re.compile(r'[.#]([A-Za-z][\w-]*)')
UNSUPPORTED_COSMETIC = ('#@#', '#?#', '#$#', '#%#', '##+js', '##^')


def site_names(site_dir):
    """Class and ID names CFlix uses, so generic hiding rules can't hide its own pages."""
    names = set()
    for file in Path(site_dir).rglob('*'):
        if file.suffix not in ('.html', '.css', '.js'):
            continue
        text = file.read_text(errors='ignore')
        names.update(SELECTOR_NAMES.findall(text))
        for value in re.findall(r'(?:class|id)="([^"]+)"', text):
            names.update(value.split())
        names.update(re.findall(r"classList\.(?:add|toggle)\('([\w-]+)'", text))
    return names


def safe_selector(selector, own_names):
    if not SAFE_SELECTOR.fullmatch(selector):
        return False
    if any(own in own_names for own in SELECTOR_NAMES.findall(selector)):
        return False
    without_allowed = ALLOWED_PSEUDO.sub('', selector)
    return ':' not in without_allowed


def pattern_to_regex(pattern):
    if pattern.startswith('/') and pattern.endswith('/') and len(pattern) > 2:
        return None
    if not pattern.isascii() or any(ch in pattern for ch in '{}\\'):
        return None

    regex = ''
    if pattern.startswith('||'):
        regex = r'^[^:]+://+([^:/]+\.)?'
        pattern = pattern[2:]
    elif pattern.startswith('|'):
        regex = '^'
        pattern = pattern[1:]

    end = ''
    if pattern.endswith('|'):
        end = '$'
        pattern = pattern[:-1]

    if '|' in pattern or pattern.strip('*^') == '':
        return None

    for ch in pattern:
        if ch == '*':
            regex += '.*'
        elif ch == '^':
            regex += '[^a-zA-Z0-9_.%-]'
        elif ch in '.+?$()[]':
            regex += '\\' + ch
        else:
            regex += ch
    return regex + end


def network_rule(line):
    exception = line.startswith('@@')
    if exception:
        line = line[2:]

    pattern, options = line, []
    if '$' in line:
        pattern, _, joined = line.rpartition('$')
        options = joined.split(',')

    trigger = {}
    types = []
    listed_types = False
    for option in options:
        negated = option.startswith('~')
        key, _, value = option.lstrip('~').partition('=')

        if key in ('third-party', '3p'):
            trigger['load-type'] = ['first-party' if negated else 'third-party']
        elif key in ('first-party', '1p'):
            trigger['load-type'] = ['third-party' if negated else 'first-party']
        elif key == 'domain' and not negated:
            domains = value.lower().split('|')
            include = [d for d in domains if not d.startswith('~')]
            exclude = [d[1:] for d in domains if d.startswith('~')]
            if include and exclude:
                return None
            chosen = include or exclude
            if not all(DOMAIN.fullmatch(d) for d in chosen):
                return None
            trigger['if-domain' if include else 'unless-domain'] = ['*' + d for d in chosen]
        elif key in RESOURCE_TYPES:
            if negated:
                return None
            listed_types = True
            if RESOURCE_TYPES[key]:
                types.append(RESOURCE_TYPES[key])
        elif key == 'match-case':
            trigger['url-filter-is-case-sensitive'] = True
        elif key == 'important':
            pass
        else:
            return None

    if listed_types and not types:
        return None

    regex = pattern_to_regex(pattern)
    if regex is None:
        return None

    trigger = {'url-filter': regex, **trigger}
    if types:
        trigger['resource-type'] = sorted(set(types))

    return exception, {'trigger': trigger, 'action': {'type': 'ignore-previous-rules' if exception else 'block'}}


def convert(lists, own_names):
    blocks, exceptions = [], []
    generic_selectors = []
    domain_selectors = {}
    skipped = 0

    for text in lists:
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith(('!', '[')):
                continue

            if any(marker in line for marker in UNSUPPORTED_COSMETIC):
                skipped += 1
                continue

            if '##' in line:
                domains, _, selector = line.partition('##')
                if not safe_selector(selector, own_names):
                    skipped += 1
                    continue
                if not domains:
                    generic_selectors.append(selector)
                    continue
                listed = domains.lower().split(',')
                include = tuple(sorted(d for d in listed if not d.startswith('~')))
                exclude = tuple(sorted(d[1:] for d in listed if d.startswith('~')))
                if (include and exclude) or not all(DOMAIN.fullmatch(d) for d in include + exclude):
                    skipped += 1
                    continue
                key = ('if-domain', include) if include else ('unless-domain', exclude)
                domain_selectors.setdefault(key, []).append(selector)
                continue

            rule = network_rule(line)
            if rule is None:
                skipped += 1
                continue
            is_exception, converted = rule
            (exceptions if is_exception else blocks).append(converted)

    hiding = []
    unique_generic = list(dict.fromkeys(generic_selectors))
    for start in range(0, len(unique_generic), SELECTORS_PER_RULE):
        batch = unique_generic[start:start + SELECTORS_PER_RULE]
        hiding.append({'trigger': {'url-filter': '.*'}, 'action': {'type': 'css-display-none', 'selector': ', '.join(batch)}})
    for (condition, domains), selectors in domain_selectors.items():
        unique = list(dict.fromkeys(selectors))
        for start in range(0, len(unique), SELECTORS_PER_RULE):
            hiding.append({
                'trigger': {'url-filter': '.*', condition: ['*' + d for d in domains]},
                'action': {'type': 'css-display-none', 'selector': ', '.join(unique[start:start + SELECTORS_PER_RULE])},
            })

    return blocks + hiding, exceptions, skipped


def main():
    output_dir, site_dir, *list_files = sys.argv[1:]
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    lists = [Path(file).read_text(errors='ignore') for file in list_files]
    rules, exceptions, skipped = convert(lists, site_names(site_dir))

    # Exceptions only cancel earlier rules in the same list, so every list
    # ends with all of them
    per_list = MAX_RULES - len(exceptions)
    for number, start in enumerate(range(0, len(rules), per_list), 1):
        chunk = json.dumps(rules[start:start + per_list] + exceptions, separators=(',', ':'))
        digest = hashlib.sha256(chunk.encode()).hexdigest()[:12]
        (output / f'cflix-{digest}-{number}.json').write_text(chunk)

    print(f'Blocklists: {len(rules)} rules and {len(exceptions)} exceptions, {skipped} filters skipped')


if __name__ == '__main__':
    main()
