const fs = require('fs');

const staticElements = JSON.parse(fs.readFileSync('scripts/static-elements.json', 'utf8'));
const dynamicElements = JSON.parse(fs.readFileSync('scripts/dynamic-elements.json', 'utf8'));
const content = fs.readFileSync('BrainzOS.html', 'utf8');

const scriptStart = content.indexOf('<script>');
const jsPart = content.slice(scriptStart);

// Let's analyze static elements first
const inventory = [];

staticElements.forEach((el, idx) => {
  // Extract id, onclick, href, type, name, class
  const idMatch = el.attrs.match(/\bid=["']([^"']+)["']/i);
  const onclickMatch = el.attrs.match(/\bonclick=["']([^"']+)["']/i);
  const hrefMatch = el.attrs.match(/\bhref=["']([^"']+)["']/i);
  const typeMatch = el.attrs.match(/\btype=["']([^"']+)["']/i);
  const nameMatch = el.attrs.match(/\bname=["']([^"']+)["']/i);
  const classMatch = el.attrs.match(/\bclass=["']([^"']+)["']/i);
  const roleAttrMatch = el.attrs.match(/\brole=["']([^"']+)["']/i);
  const ariaLabelMatch = el.attrs.match(/\baria-label=["']([^"']+)["']/i);

  const id = idMatch ? idMatch[1] : null;
  const onclick = onclickMatch ? onclickMatch[1] : null;
  const href = hrefMatch ? hrefMatch[1] : null;
  const type = typeMatch ? typeMatch[1] : null;
  const className = classMatch ? classMatch[1] : '';
  const label = el.inner || (ariaLabelMatch ? ariaLabelMatch[1] : (id || nameMatch ? (id || nameMatch[1]) : el.tag));

  // Determine role applicability
  let role = 'all';
  if (el.page.startsWith('page-student')) role = 'student';
  else if (el.page.startsWith('page-teacher')) role = 'teacher';
  else if (el.page.startsWith('page-director')) role = 'director';
  else if (el.page === 'login-viewport') role = 'unauthenticated';
  else {
    // Global shell or modal
    if (id && id.includes('student')) role = 'student';
    else if (id && id.includes('teacher')) role = 'teacher';
    else if (id && id.includes('director')) role = 'director';
  }

  // Determine handler
  let handlerExists = false;
  let handlerName = '';
  let doesWhat = '';
  let realBackend = false;
  let status = 'WORKING';
  let issue = '';

  if (onclick) {
    handlerExists = true;
    const fnNameMatch = onclick.match(/([a-zA-Z0-9_]+)\s*\(/);
    handlerName = fnNameMatch ? fnNameMatch[1] : onclick;
  } else if (id) {
    // Check if addEventListener or form submit or input handler exists
    const hasListener = jsPart.includes(`'${id}'`) || jsPart.includes(`"${id}"`);
    if (hasListener) {
      handlerExists = true;
      handlerName = `listener on #${id}`;
    }
  }

  if (el.tag === 'a') {
    if (href === '#' || href === 'javascript:void(0)' && !onclick) {
      status = 'DEAD';
      issue = 'href="#" or javascript:void(0) without handler';
    } else if (href && !href.startsWith('javascript:')) {
      handlerExists = true;
      doesWhat = `Links to ${href}`;
    }
  }

  if (el.tag === 'input' || el.tag === 'select' || el.tag === 'textarea') {
    handlerExists = true;
    doesWhat = `Form input / select (${id || nameMatch ? (id || nameMatch[1]) : type})`;
  }

  inventory.push({
    index: idx + 1,
    tag: el.tag,
    id,
    page: el.page,
    label: label.replace(/\s+/g, ' ').trim(),
    onclick,
    href,
    role,
    handlerExists,
    handlerName,
    doesWhat,
    realBackend,
    status,
    issue
  });
});

console.log('Processed', inventory.length, 'static elements');
fs.writeFileSync('scripts/initial-inventory.json', JSON.stringify(inventory, null, 2));
