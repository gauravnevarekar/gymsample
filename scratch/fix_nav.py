import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

mapping = [
    (r'\b(Dashboard|Dash|Overview)\b', 'index.html'),
    (r'\b(Members)\b', 'member_directory.html'),
    (r'\b(Expenses|Bills)\b', 'expense_management.html'),
    (r'\b(Settings|Config|Profile)\b', 'admin_profile.html'),
    (r'\b(Plans|Payments|Schedules|Schedule)\b', 'plan_management.html'),
]

for filename in html_files:
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    def replace_link(match):
        a_tag = match.group(0)
        
        # Only replace if it's pointing to #
        if 'href="#"' not in a_tag:
            return a_tag
            
        # Match inner text or spans inside the a tag
        inner = match.group(1)
        
        for pattern, url in mapping:
            if re.search(pattern, inner, re.IGNORECASE):
                return a_tag.replace('href=\"#\"', f'href="{url}"')
                
        return a_tag

    # regex to find <a ...> ... </a>
    new_content = re.sub(r'<a[^>]*>(.*?)</a>', replace_link, content, flags=re.DOTALL)
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
print("Updated all files!")
