from langfuse import Langfuse

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, declarative_base, relationship, Mapped, mapped_column
from sqlalchemy import Integer, String, Boolean, ForeignKey
from typing import Optional
import json


##### NEED TO RUN THIS COMMAND BEFOREHAND #####

"""
/../overwatch/cli/target/debug/cli --auth-token .. --organization-slug codecov --commit-sha 2074673143ea4217119b02621f6ae9dcd47f6c46 --repo-slug codecov/codecov-api --pullid 1162 python --tool mypy --python-path python
"""

# Then query the OW DB to get the upload_id

################################


##### UPDATE THESE VALUES #####

DB_USER = "suejung.shin"
DB_PASSWORD = ""

REPO_NAME = "getsentry"
ORGANIZATION = "sentry"
COMMIT_SHA = "4d44890fe1bfdb26c6bd2e640e89b7fd88e8a38b"
PR_NUMBER = 16675
UPLOAD_ID = 12658

EXPECTED_OUTPUT = {
    "description": """
This PR removed several static images from static/getsentry/images as part of a migration and cleanup effort. However, it overlooked the fact that some emails referenced these image paths directly, resulting in broken image links in emails until the files were restored.
""",
    "encoded_location": "static/getsentry/images",
    "repos": ["getsentry/getsentry"],
}

###############################

EncodedLocation = str
Location = str
FormattedCode = list[str]

Base = declarative_base()

class StaticAnalysisWarning(Base):
    __tablename__ = "warnings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    commit_id: Mapped[int] = mapped_column(ForeignKey("commits.id"), nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    encoded_location: Mapped[EncodedLocation] = mapped_column(String, nullable=False)
    encoded_code_snippet: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    rule_id: Mapped[Optional[int]] = mapped_column(ForeignKey("static_analysis_rules.id"), nullable=True)
    upload_id: Mapped[Optional[int]] = mapped_column(ForeignKey("uploads.id"), nullable=True)
    is_first_occurrence: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    rule: Mapped[Optional["StaticAnalysisRule"]] = relationship()
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    project: Mapped["Project"] = relationship(back_populates="static_analysis_warnings")
    associated_issues: Mapped[list["AssociationIssueWarning"]] = relationship(
        back_populates="warning", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"({self.code}@{self.encoded_location})"

    @property
    def code_snippet(self) -> Optional[FormattedCode]:
        if not self.encoded_code_snippet:
            return None
        return self.encoded_code_snippet.split("\n")

# Dummy relationships for demo purposes
class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    static_analysis_warnings: Mapped[list[StaticAnalysisWarning]] = relationship(back_populates="project")

class StaticAnalysisRule(Base):
    __tablename__ = "static_analysis_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String, nullable=False)
    tool: Mapped[str] = mapped_column(String, nullable=False)
    is_autofixable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_stable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    category: Mapped[str] = mapped_column(String, nullable=False)

    warnings: Mapped[list["StaticAnalysisWarning"]] = relationship(
        back_populates="rule", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"{self.id}-{self.code}-{self.tool}"

class AssociationIssueWarning(Base):
    __tablename__ = "association_issue_warnings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    warning_id: Mapped[int] = mapped_column(ForeignKey("warnings.id"))
    warning: Mapped[StaticAnalysisWarning] = relationship(back_populates="associated_issues")


DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@overwatch-bastion-prod.codecov.dev:5400/overwatch"
engine = create_engine(DATABASE_URL)
Base.metadata.create_all(bind=engine)

def get_warnings_by_upload_id(upload_id: int):
    with Session(engine) as session:
        stmt = select(StaticAnalysisWarning).filter(StaticAnalysisWarning.upload_id == upload_id)
        warnings = session.scalars(stmt).all()

        warnings_list = []
        for warning in warnings:
            warning_dict = warning.__dict__.copy()
            warning_dict.pop('_sa_instance_state', None)
            warning_dict.pop('project_id', None)
            warning_dict.pop('commit_id', None)
            warning_dict.pop('upload_id', None)

            # Serialize the related rule, if it exists
            if warning.rule:
                warning_dict['rule'] = {
                    'id': warning.rule.id,
                    'code': warning.rule.code,
                    'tool': warning.rule.tool,
                    'is_autofixable': warning.rule.is_autofixable,
                    'is_stable': warning.rule.is_stable,
                    'category': warning.rule.category,
                }
            else:
                warning_dict['rule'] = None

            warnings_list.append(warning_dict)

        return warnings_list


def build_body_object(
    sentryRepoProviderId: str,
    owner: str,
    repoName: str,
    providerRepoId: int,
    prNumber: int,
    sentryOrgId: str,
    commitSha: str,
    warnings: list[dict],
    callbackUrl: str,
) -> dict:
    enriched_warnings = []
    for warning in warnings:
        warning_copy = warning.copy()
        warning_copy["commit_id"] = commitSha
        enriched_warnings.append(warning_copy)

    body = {
        "repo": {
            "provider": sentryRepoProviderId,
            "owner": owner,
            "name": repoName,
            "external_id": str(providerRepoId),
        },
        "pr_id": prNumber,
        "organization_id": sentryOrgId,
        "commit_sha": commitSha,
        "warnings": enriched_warnings,
        "callback_url": callbackUrl,
    }

    return body


if 'UPLOAD_ID' in globals() and UPLOAD_ID:
    warnings_data = get_warnings_by_upload_id(UPLOAD_ID)
    if warnings_data:
        # Truncate to the top 1000 warnings
        warnings_data = warnings_data[:1000]
    else:
        warnings_data = []
else:
    warnings_data = []


misc_input_mapping = {
    "providerRepoId": {
        "seer": 439438299,
        "codecov-api": 667550736,
        "overwatch": 904533877,
        "worker": 665728948,
        "shared": 667551874,
        "gazebo": 310336565,
        "sentry": 873328,
        "getsentry": 3060925,
    },
    "sentryOrgId": {"codecov": 26192, "sentry": 1},
}


# body_input = build_body_object(
#     sentryRepoProviderId="integrations:github",
#     owner=ORGANIZATION,
#     repoName=REPO_NAME,
#     providerRepoId=misc_input_mapping["providerRepoId"][REPO_NAME],
#     prNumber=PR_NUMBER,
#     sentryOrgId=misc_input_mapping["sentryOrgId"][ORGANIZATION],
#     commitSha=COMMIT_SHA,
#     warnings=warnings_data,
#     callbackUrl=""
# )

# langfuse = Langfuse()
# langfuse.create_dataset_item(
#     dataset_name='relevant-warnings',
#     input=body_input,
#     expected_output=EXPECTED_OUTPUT
# )

def get_upload_ids_by_pullid(pullid: int) -> list[int]:
    with Session(engine) as session:
        # Define Upload class outside the function to avoid redefinition
        # Use extend_existing=True to avoid the "Table already defined" error
        class Upload(Base):
            __tablename__ = "uploads"
            __table_args__ = {'extend_existing': True}
            id: Mapped[int] = mapped_column(Integer, primary_key=True)
            pullid: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
        
        # Create a query using SQLAlchemy's select statement
        # Order by id in descending order to get the most recent uploads first
        query = select(Upload.id).where(Upload.pullid == pullid).order_by(Upload.id.desc())
        
        # Execute the query and fetch all results
        results = session.execute(query).fetchall()
        
        # Extract the IDs from the result rows
        upload_ids = [row[0] for row in results] if results else []
        
        return upload_ids


# Initialize output file with an empty array
output_path = "dataset_items_with_warnings.json"
with open(output_path, 'w') as f:
    json.dump([], f)

# Load the existing dataset items
dataset_items_path = "dataset_items.json"
try:
    with open(dataset_items_path, 'r') as f:
        dataset_items = json.load(f)
    
    # Process items one by one and write to output file as we go
    processed_count = 0
    for item in dataset_items:
        if 'input' in item and 'pr_id' in item['input']:
            pr_id = item['input']['pr_id']
            print(f"Processing pull ID {pr_id} ({processed_count + 1}/{len(dataset_items)})")
            
            # Get upload IDs for this pull ID
            upload_ids = get_upload_ids_by_pullid(pr_id)
            print(f"Found {len(upload_ids)} upload IDs for pull ID {pr_id}")
            
            # Get warnings for the first upload ID only
            warnings_list = []
            if upload_ids:
                first_upload_id = upload_ids[0]
                warnings_list = get_warnings_by_upload_id(first_upload_id)
                print(f"Using first upload ID {first_upload_id} with {len(warnings_list)} warnings")
            
            # Add warnings to the item
            item['input']['warnings'] = warnings_list
            print(f"Added {len(warnings_list)} warnings for pull ID {pr_id}")
        
        # Read the current content of the output file
        with open(output_path, 'r') as f:
            current_items = json.load(f)
        
        # Append the processed item
        current_items.append(item)
        
        # Write back to the output file
        with open(output_path, 'w') as f:
            json.dump(current_items, f, indent=4)
        
        processed_count += 1
        print(f"Progress: {processed_count}/{len(dataset_items)} items processed")
    
    print(f"Successfully created {output_path} with warnings data added")
except Exception as e:
    print(f"Error processing dataset items: {str(e)}")
    import traceback
    traceback.print_exc()
